# Blue-Green Zero-Downtime Deployment Guide

**Date:** 2026-06-29  
**Target:** New GCP VPS (different Google Cloud account)  
**Architecture:** AI Platform (OmniRoute + Customer Portal + Cloud SQL + Memorystore)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Google Cloud Setup (New Account)](#2-google-cloud-setup-new-account)
3. [Database Strategy (The Critical Piece)](#3-database-strategy-the-critical-piece)
4. [Infrastructure Configuration](#4-infrastructure-configuration)
5. [Docker Compose — Blue-Green Service Definitions](#5-docker-compose--blue-green-service-definitions)
6. [Nginx — Upstream Swap Configuration](#6-nginx--upstream-swap-configuration)
7. [Deploy Script — Blue-Green Orchestration](#7-deploy-script--blue-green-orchestration)
8. [Rollback Procedure](#8-rollback-procedure)
9. [Migration Playbook: Moving from Old VPS to New VPS](#9-migration-playbook-moving-from-old-vps-to-new-vps)
10. [Operation Runbook](#10-operation-runbook)
11. [Long-Term: SQLite-to-PostgreSQL Migration](#11-long-term-sqlite-to-postgresql-migration)

---

## 1. Architecture Overview

### Current (Single Instance) — What You Have Now

```
Internet → Nginx
             ├── /v1/*       → omniroute_api    (:20129)  [single instance]
             ├── /           → customer_portal   (:3000)   [single instance]
             └── admin.*/    → omniroute_dashboard (:20128) [single instance]

State:
  Customer Portal → Cloud SQL (PostgreSQL) ✅  Fully externalized
  OmniRoute       → SQLite in Docker volume    ❌  Single-process only
  Session/Cache   → Cloud Memorystore (Redis)  ✅  Fully externalized
```

### Target (Blue-Green) — What We're Building

```
Internet → Nginx (upstream swap on reload)
             ├── /v1/*       → omniroute_api    →  BLUE (:20129)  or  GREEN (:20139)
             ├── /           → customer_portal  →  BLUE (:3000)   or  GREEN (:3001)
             └── admin.*/    → omniroute_dash   →  BLUE (:20128)  or  GREEN (:20138)

State:
  Customer Portal → Cloud SQL (PostgreSQL) ✅  Shared — both environments read/write
  OmniRoute SQLite → Copied volume         ✅  Only one env has it at a time
  Session/Cache   → Cloud Memorystore      ✅  Shared — both environments use same Redis
```

### Key Principle

At any moment, **only one environment (Blue or Green) is receiving production traffic**. The other is either:
- Idle/stopped (cold standby)
- Being verified after deploy (warm standby)
- Being rolled back from

This avoids the previous dual-instance failure where both wrote to the same SQLite file simultaneously.

---

## 2. Google Cloud Setup (New Account)

### 2.1 Create the VPS Instance

| Setting | Value |
|---------|-------|
| **Machine type** | `e2-standard-4` (4 vCPU, 16 GB RAM) — same as current |
| **Boot disk** | 100 GB balanced persistent disk |
| **OS** | Ubuntu 24.04 LTS (or Debian 12) |
| **Firewall** | Allow HTTP (80), HTTPS (443), Health Check ranges |
| **Region** | Same as your Cloud SQL instance region (for low latency) |

```bash
# SSH in and install prerequisites
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Node.js 22 (for local management scripts)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
```

### 2.2 Set Up Cloud SQL (PostgreSQL)

Since your **customer portal** already uses Cloud SQL, you'll need to set this up in the new account:

```bash
# Via gcloud CLI or Console:
# 1. Create a Cloud SQL PostgreSQL 15 instance
gcloud sql instances create ai-platform-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-7680 \
  --region=us-central1 \
  --availability-type=ZONAL \
  --storage-size=20GB \
  --storage-auto-increase \
  --backup-start-time=03:00

# 2. Create the database
gcloud sql databases create aiplatform --instance=ai-platform-db

# 3. Create a user
gcloud sql users create appuser --instance=ai-platform-db --password=<secure-password>

# 4. Get the connection name
gcloud sql instances describe ai-platform-db --format='value(connectionName)'
# → project:region:instance
result: project-cfb8e967-41b8-4699-a8e:us-central1:ai-platform-db

# 5. Configure the VPS to connect via Private IP or Cloud SQL Auth Proxy:
# Option A: Private IP (recommended — lowest latency)
gcloud compute networks vpc-access connectors create ai-connector \
  --region=us-central1 \
  --network=default \
  --range=10.8.0.0/28
# Then enable Private IP on the Cloud SQL instance.

# Option B: Cloud SQL Auth Proxy (simpler, no VPC config)
# Run as a sidecar container (see docker-compose below)
```

**⚠️ CRITICAL — Database Migration Strategy (see Section 3)**

Cloud SQL handles the **customer portal** data (users, subscriptions, API keys). This is already externalized and blue-green safe.

For **OmniRoute's SQLite** — this remains in a Docker volume. The blue-green strategy manages this via volume copying. See Section 3 for full details.

### 2.3 Set Up Cloud Memorystore (Redis)

Your architecture already uses external Redis. Set this up in the new account:

```bash
gcloud redis instances create ai-platform-redis \
  --size=2 \
  --region=us-central1 \
  --redis-version=redis_7_x \
  --network=default \
  --connect-mode=PRIVATE_SERVICE_ACCESS

# Get the Redis host IP
gcloud redis instances describe ai-platform-redis --region=us-central1 \
  --format='value(host)'
```

### 2.4 DNS Setup

Point your domain to the new VPS **before** the migration cutover:

```bash
# Old VPS IP → keep as-is until cutover
# New VPS IP → add as secondary, will switch during migration

# For blue-green with zero downtime during the cutover itself:
# 1. Set DNS TTL to 60 seconds (24h before migration)
# 2. On cutover day, update A record to new VPS IP
# 3. Wait 60s for propagation → new connections go to new VPS
# 4. Old VPS still running → drain existing connections
```

---

## 3. Database Strategy (The Critical Piece)

This is the most important section. Your previous dual-instance attempt failed because of concurrent SQLite access. Here's how blue-green solves it.

### 3.1 The Three Data Stores

| Data Store | Customer Portal | OmniRoute | Blue-Green Safety |
|------------|----------------|-----------|-------------------|
| **Cloud SQL (PostgreSQL)** | Users, subscriptions, API keys, billing | — | ✅ Fully safe. Both environments connect to the same database. Prisma migrations run once before deploy. |
| **Docker Volume (SQLite)** | — | Provider connections, call logs, credentials, settings, proxy pool state, model catalog | ⚠️ Must be handled carefully. Only one environment can have the SQLite file open at a time. |
| **Cloud Memorystore (Redis)** | Sessions (via NextAuth) | Session persistence, rate limits, cooldowns, account pool state, token counters | ✅ Fully safe. Both environments read/write the same Redis instance. Stateless from the app's perspective. |

### 3.2 SQLite Strategy: Copy, Don't Share

The key insight: **both environments never have the SQLite volume mounted simultaneously**.

```
Deploy Flow:
  1. BLUE is running at ports :20128/:20129 — serving traffic
  2. Stop BLUE's OmniRoute (traffic already on BLUE, but this is the brief window)
  
  [CRITICAL: Stop BLUE OmniRoute BEFORE starting GREEN OmniRoute]
  
  3. Copy SQLite data from ai-omniroute-data to ai-omniroute-data-green
     docker run --rm -v ai-omniroute-data:/src:ro -v ai-omniroute-data-green:/dst \
       alpine sh -c "cp -a /src/. /dst/"
  
  4. Start GREEN OmniRoute on ports :20138/:20139 with ai-omniroute-data-green volume
  
  5. Wait for GREEN health check → if healthy, swap nginx → if unhealthy, abort
  
  6. GREEN is now serving traffic. BLUE's OmniRoute is stopped.
  
  7. (Optional) Keep BLUE's other services running for quick rollback, or stop them.
```

**Why this is safe (unlike the previous dual-instance failure):**

| Previous Failure | Blue-Green (This Guide) |
|-----------------|------------------------|
| Two instances had the SQLite volume mounted at the same time → writes conflicted | Only ONE instance ever has the SQLite volume mounted |
| Both instances served traffic simultaneously → state divergence | Only ONE instance serves traffic at a time |
| Background jobs ran on both → duplicate API calls | Background jobs run on only the active instance |
| Nginx load-balanced across both → inconsistent admin UI | Nginx points to one upstream at a time |

### 3.3 The Brief Downtime Window

There is a **~5-10 second window** between stopping BLUE and starting GREEN where OmniRoute is unavailable:

1. Stop BLUE OmniRoute container → 502 errors from nginx (~1s)
2. Copy SQLite volume → 5-10s (1.5 GB volume)
3. Start GREEN OmniRoute → 30-60s health check delay

**Total: ~5-10 seconds of downtime for new requests.**

**In-flight SSE streams** are terminated when BLUE stops — same as your current deploy. This is inherent and cannot be solved without adding a drain mode (Phase 2 in the feasibility doc).

### 3.4 PostgreSQL Migrations (Customer Portal)

Your customer portal uses Prisma with Cloud SQL. This is already blue-green safe:

```bash
# Before starting GREEN, run migrations once:
docker compose run --rm customer-portal-green \
  sh -c "node node_modules/prisma/build/index.js migrate deploy"

# Both BLUE and GREEN read from the same database.
# Prisma migrations are designed to be backward-compatible:
# - New columns must have defaults or be nullable
# - No destructive changes (drop columns/tables) without a multi-phase deploy
# - Test migrations on a staging DB first
```

**Best Practice for Blue-Green Safe Schema Changes:**

```
Phase 1 Deploy (this migration):
  - ADD column (with default) → old code ignores it ✅
  - CREATE new table → old code doesn't use it ✅

Phase 2 Deploy (next release):
  - Remove old column references from code
  - DROP column → only after Phase 1 is fully deployed ✅
```

### 3.5 Redis (Memorystore) — Trivially Safe

Both BLUE and GREEN connect to the same Redis instance. Redis handles concurrent access natively. No special handling needed.

---

## 4. Infrastructure Configuration

### 4.1 Environment Variables

Create `.env` on the new VPS. This is the same structure you already use with some additions for blue-green:

```bash
# ═══════════════════════════════════════════════
# AI Platform — Environment Configuration
# ═══════════════════════════════════════════════

# Domain
DOMAIN=aikompute.com
PUBLIC_URL=https://aikompute.com
SSL_ENABLED=true

# Cloud SQL (PostgreSQL)
DATABASE_URL=postgresql://appuser:<password>@<cloud-sql-private-ip>:5432/aiplatform
PORTAL_JWT_SECRET=<generate-64-char-random>

# Cloud Memorystore (Redis)
REDIS_URL=redis://:<password>@<redis-private-ip>:6379
REDIS_PASSWORD=<redis-auth-string>

# OmniRoute
OMNIROUTE_JWT_SECRET=<generate-64-char-random>
OMNIROUTE_API_KEY_SECRET=<generate-64-char-random>
OMNIROUTE_STORAGE_ENCRYPTION_KEY=<generate-64-char-random>
OMNIROUTE_INITIAL_PASSWORD=<admin-password>
OMNIROUTE_PUBLIC_URL=https://admin.aikompute.com

# Auth
NEXTAUTH_SECRET=<generate-64-char-random>
ADMIN_API_SECRET=<generate-64-char-random>

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_MAX_5X=price_...
STRIPE_PRICE_ID_MAX_20X=price_...
STRIPE_PRICE_ID_PAYG=price_...

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@aikompute.com

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
APPLE_CLIENT_ID=...
APPLE_CLIENT_SECRET=...

# Artificial Analysis (optional)
AA_API_KEY=...

# Blue-Green: current active slot (blue or green)
ACTIVE_SLOT=blue
```

### 4.2 Let's Encrypt SSL

```bash
# Set up SSL for your domain
sudo certbot --nginx -d aikompute.com -d admin.aikompute.com

# Auto-renewal is configured by default
sudo certbot renew --dry-run
```

---

## 5. Docker Compose — Blue-Green Service Definitions

Here's the modified [`docker-compose.unified.yml`](docker-compose.unified.yml). The key changes:

1. Add **green** service definitions on alternate ports (`:20138/:20139`, `:3001`)
2. Add **green** Docker volumes (`ai-omniroute-data-green`, `ai-portal-data-green`)
3. The **blue** services remain unchanged (current ports)

`docker-compose.unified.yml`:

```yaml
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Docker Compose (Blue-Green Deployment)
# ══════════════════════════════════════════════════════════════════════════════
#
#  Blue:  active environment (default, serving traffic)
#  Green: standby environment (deployed to during updates, then swapped)
#
# ══════════════════════════════════════════════════════════════════════════════

x-logging: &logging
  driver: json-file
  options:
    max-size: "50m"
    max-file: "5"

# ── Blue Environment ────────────────────────────────────────────────────────
x-omniroute-blue: &omniroute-blue
  image: ghcr.io/aikomputeapi-web/ai-platform/omniroute:${IMAGE_TAG:-latest}
  restart: unless-stopped
  stop_grace_period: 40s
  logging: *logging
  env_file: ./OmniRoute/.env
  mem_limit: 1536m
  memswap_limit: 1536m
  environment:
    NODE_ENV: production
    DATA_DIR: /app/data
    PORT: 20128
    DASHBOARD_PORT: 20128
    API_PORT: 20129
    API_HOST: 0.0.0.0
    JWT_SECRET: ${OMNIROUTE_JWT_SECRET:?}
    API_KEY_SECRET: ${OMNIROUTE_API_KEY_SECRET:?}
    INITIAL_PASSWORD: ${OMNIROUTE_INITIAL_PASSWORD:?}
    STORAGE_ENCRYPTION_KEY: ${OMNIROUTE_STORAGE_ENCRYPTION_KEY:?}
    REDIS_URL: ${REDIS_URL:?}
    PORTAL_DATABASE_URL: ${DATABASE_URL:?}
    NEXT_PUBLIC_BASE_URL: https://admin.aikompute.com
    BASE_URL: https://admin.aikompute.com
    REQUIRE_API_KEY: "true"
    AUTH_COOKIE_SECURE: ${SSL_ENABLED:-false}
    CLI_COMPAT_ALL: "1"
    ENABLE_TLS_FINGERPRINT: "true"
    ENABLE_SOCKS5_PROXY: "true"
    OMNIROUTE_MEMORY_MB: 1024
    NODE_OPTIONS: "--max-old-space-size=1024"
    STREAM_IDLE_TIMEOUT_MS: 600000
    FETCH_TIMEOUT_MS: 600000
    APP_LOG_TO_FILE: "true"
    APP_LOG_LEVEL: info
    OPENROUTER_FREE_ONLY: "true"
    NVIDIA_FREE_ONLY: "true"
  volumes:
    - omniroute_data_blue:/app/data
    - ./OmniRoute/proxy_scraper_data:/app/proxy_scraper_data:ro
  networks:
    ai-network:
      aliases:
        - omniroute
  healthcheck:
    test: ["CMD", "node", "-e", "const http = require('http'); const req = http.request('http://127.0.0.1:20128', { timeout: 2000 }, (res) => { process.exit(res.statusCode === 200 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 404 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"]
    interval: 5s
    timeout: 3s
    retries: 10
    start_period: 60s

x-portal-blue: &portal-blue
  image: ghcr.io/aikomputeapi-web/ai-platform/customer-portal:${IMAGE_TAG:-latest}
  restart: unless-stopped
  logging: *logging
  mem_limit: 512m
  memswap_limit: 512m
  depends_on:
    omniroute-blue:
      condition: service_healthy
  environment:
    DATABASE_URL: ${DATABASE_URL:?}
    JWT_SECRET: ${PORTAL_JWT_SECRET:?}
    OMNIROUTE_INTERNAL_URL: http://omniroute-blue:20128
    OMNIROUTE_ADMIN_PASSWORD: ${OMNIROUTE_INITIAL_PASSWORD:?}
    NEXT_PUBLIC_APP_URL: ${PUBLIC_URL:-http://localhost:3000}
    NEXT_PUBLIC_APP_NAME: ${APP_NAME:-AI API Platform}
    STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:-}
    STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET:-}
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${STRIPE_PUBLISHABLE_KEY:-}
    STRIPE_PRICE_ID_PRO: ${STRIPE_PRICE_ID_PRO:-}
    STRIPE_PRICE_ID_MAX_5X: ${STRIPE_PRICE_ID_MAX_5X:-}
    STRIPE_PRICE_ID_MAX_20X: ${STRIPE_PRICE_ID_MAX_20X:-}
    STRIPE_PRICE_ID_PAYG: ${STRIPE_PRICE_ID_PAYG:-}
    RESEND_API_KEY: ${RESEND_API_KEY:-}
    EMAIL_FROM: ${EMAIL_FROM:-noreply@example.com}
    ADMIN_API_SECRET: ${ADMIN_API_SECRET:?}
    AA_API_KEY: ${AA_API_KEY:-}
    NODE_ENV: production
    NEXTAUTH_URL: ${PUBLIC_URL:-http://localhost:3000}
    NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:?}
    GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
    GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
    GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID:-}
    GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET:-}
    APPLE_CLIENT_ID: ${APPLE_CLIENT_ID:-}
    APPLE_CLIENT_SECRET: ${APPLE_CLIENT_SECRET:-}
  networks:
    ai-network:
      aliases:
        - customer-portal
  healthcheck:
    test: ["CMD", "node", "-e", "const http = require('http'); const req = http.request('http://127.0.0.1:3000/api/health', { timeout: 2000 }, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"]
    interval: 5s
    timeout: 3s
    retries: 5
    start_period: 15s

# ── Green Environment ───────────────────────────────────────────────────────
x-omniroute-green: &omniroute-green
  <<: *omniroute-blue
  volumes:
    - omniroute_data_green:/app/data
    - ./OmniRoute/proxy_scraper_data:/app/proxy_scraper_data:ro
  environment:
    <<: *omniroute-blue
    PORT: 20138
    DASHBOARD_PORT: 20138
    API_PORT: 20139
  healthcheck:
    test: ["CMD", "node", "-e", "const http = require('http'); const req = http.request('http://127.0.0.1:20138', { timeout: 2000 }, (res) => { process.exit(res.statusCode === 200 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 404 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"]
    interval: 5s
    timeout: 3s
    retries: 10
    start_period: 60s

x-portal-green: &portal-green
  <<: *portal-blue
  depends_on:
    omniroute-green:
      condition: service_healthy
  environment:
    <<: *portal-blue
    OMNIROUTE_INTERNAL_URL: http://omniroute-green:20138
  healthcheck:
    test: ["CMD", "node", "-e", "const http = require('http'); const req = http.request('http://127.0.0.1:3001/api/health', { timeout: 2000 }, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"]
    interval: 5s
    timeout: 3s
    retries: 5
    start_period: 15s

services:

  # ══════════════════════════════════════════════════════════════════════════
  # BLUE Environment (Active / Serving Traffic)
  # ══════════════════════════════════════════════════════════════════════════
  omniroute-blue:
    <<: *omniroute-blue
    container_name: omniroute-blue
    ports:
      - "127.0.0.1:20128:20128"
      - "127.0.0.1:20129:20129"

  customer-portal-blue:
    <<: *portal-blue
    container_name: customer-portal-blue
    ports:
      - "127.0.0.1:3000:3000"

  # ══════════════════════════════════════════════════════════════════════════
  # GREEN Environment (Standby / Deploy Target)
  # ══════════════════════════════════════════════════════════════════════════
  omniroute-green:
    <<: *omniroute-green
    container_name: omniroute-green
    ports:
      - "127.0.0.1:20138:20138"
      - "127.0.0.1:20139:20139"

  customer-portal-green:
    <<: *portal-green
    container_name: customer-portal-green
    ports:
      - "127.0.0.1:3001:3001"

  # ══════════════════════════════════════════════════════════════════════════
  # Report Deliverer (runs once, always against the active slot)
  # ══════════════════════════════════════════════════════════════════════════
  report-deliverer:
    image: ghcr.io/aikomputeapi-web/ai-platform/customer-portal:${IMAGE_TAG:-latest}
    container_name: report-deliverer
    restart: unless-stopped
    logging: *logging
    mem_limit: 256m
    memswap_limit: 256m
    depends_on:
      customer-portal-blue:
        condition: service_healthy
    command: ["node", "scripts/deliver-scheduled-reports.mjs"]
    environment:
      PORTAL_INTERNAL_URL: http://customer-portal-blue:3000
      REPORT_DELIVERY_SECRET: ${ADMIN_API_SECRET:?}
      REPORT_DELIVERY_LIMIT: 20
      REPORT_DELIVERY_INTERVAL_SECONDS: 300
      NODE_ENV: production
    healthcheck:
      test: ["CMD", "node", "-e", "const http = require('http'); http.get('http://customer-portal-blue:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    networks:
      - ai-network

  # ══════════════════════════════════════════════════════════════════════════
  # Free Models Extractor
  # ══════════════════════════════════════════════════════════════════════════
  free-models-extractor:
    image: node:24-alpine
    container_name: free-models-extractor
    restart: unless-stopped
    logging: *logging
    mem_limit: 256m
    memswap_limit: 256m
    volumes:
      - ./scripts:/app/scripts
      - omniroute_data_blue:/app/data
    working_dir: /app
    environment:
      OUTPUT_DIR: /app/data
      INTERVAL_SECONDS: 86400
    networks:
      - ai-network
    command: ["node", "scripts/extract-free-models.mjs"]

# ═══════════════════════════════════════════════════════════════════════════════
# Volumes
# ═══════════════════════════════════════════════════════════════════════════════
volumes:
  omniroute_data_blue:
    name: ai-omniroute-data
  omniroute_data_green:
    name: ai-omniroute-data-green

# ═══════════════════════════════════════════════════════════════════════════════
# Network
# ═══════════════════════════════════════════════════════════════════════════════
networks:
  ai-network:
    name: ai-platform-network
    driver: bridge
```

**Changes from current `docker-compose.unified.yml`:**

| Change | Reason |
|--------|--------|
| `omniroute` → `omniroute-blue`, `customer-portal` → `customer-portal-blue` | Renamed to be explicit about which slot |
| Added `omniroute-green` on ports `:20138/:20139` | Green OmniRoute instance |
| Added `customer-portal-green` on port `:3001` | Green customer portal instance |
| Split volumes: `omniroute_data_blue` and `omniroute_data_green` | No concurrent SQLite access |
| `report-deliverer` always points to `customer-portal-blue` | Workers always talk to the active slot (updated during swap) |

---

## 6. Nginx — Upstream Swap Configuration

Here's the modified [`nginx/nginx.conf`](nginx/nginx.conf). The key changes:

1. **Dual upstream entries** — each upstream has both BLUE and GREEN servers
2. **`ACTIVE_SLOT` variable** — determines which server is `down` (nginx marks it as unavailable)
3. **`reload`-safe swap** — nginx picks up the new config without dropping connections

```nginx
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Nginx (Blue-Green Zero-Downtime)
# ══════════════════════════════════════════════════════════════════════════════
#
#  Blue:  20128 (dashboard), 20129 (API), 3000 (portal)
#  Green: 20138 (dashboard), 20139 (API), 3001 (portal)
#
#  Only ONE environment is "up" at a time. The deploy script swaps which
#  server is marked as "down" via sed, then reloads nginx.
#
# ══════════════════════════════════════════════════════════════════════════════

worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 8192;
    multi_accept on;
    use epoll;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    types_hash_max_size 2048;
    server_tokens off;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" rt=$upstream_response_time';
    access_log /var/log/nginx/access.log main buffer=16k flush=2m;
    error_log /var/log/nginx/error.log warn;

    # Timeouts
    keepalive_timeout 300s;
    client_header_timeout 60s;
    client_body_timeout 300s;
    send_timeout 300s;
    client_max_body_size 50m;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 4;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=20r/s;
    limit_req_zone $binary_remote_addr zone=dash_limit:10m rate=10r/s;

    # ── Upstreams (Blue-Green) ──
    # One server is "down" (inactive), the other serves traffic.
    # The deploy script swaps the "down" marker between blue/green.
    #
    # ACTIVE_SLOT=blue:  20128 UP, 20138 DOWN
    # ACTIVE_SLOT=green: 20128 DOWN, 20138 UP

    upstream omniroute_dashboard {
        server 127.0.0.1:20128 max_fails=3 fail_timeout=10s;   # BLUE
        server 127.0.0.1:20138 max_fails=3 fail_timeout=10s down;  # GREEN (default: standby)
        keepalive 32;
    }

    upstream omniroute_api {
        server 127.0.0.1:20129 max_fails=3 fail_timeout=10s;   # BLUE
        server 127.0.0.1:20139 max_fails=3 fail_timeout=10s down;  # GREEN (default: standby)
        keepalive 100;
    }

    upstream customer_portal {
        server 127.0.0.1:3000 max_fails=3 fail_timeout=10s;    # BLUE
        server 127.0.0.1:3001 max_fails=3 fail_timeout=10s down;   # GREEN (default: standby)
        keepalive 16;
    }

    # ── HTTP → HTTPS redirect ──
    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # ══════════════════════════════════════════════════════════════════════
    # MAIN SERVER
    # ══════════════════════════════════════════════════════════════════════
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name DOMAIN_PLACEHOLDER;

        ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1d;

        # Security headers
        add_header X-Frame-Options SAMEORIGIN always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

        # ── /v1/* — OpenAI-compatible API ──
        location /v1/ {
            limit_req zone=api_limit burst=40 nodelay;

            proxy_pass http://omniroute_api;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Failover to green slot if blue is down
            proxy_next_upstream error timeout invalid_header http_502 http_503 http_504;
            proxy_next_upstream_tries 2;
            proxy_next_upstream_timeout 5s;

            # SSE streaming
            proxy_buffering off;
            proxy_cache off;
            proxy_read_timeout 600s;
            proxy_send_timeout 600s;
            proxy_request_buffering off;
        }

        # ── /health — Quick health check ──
        location /health {
            access_log off;
            default_type application/json;
            return 200 '{"status":"ok"}';
        }

        # ── / — Customer Portal ──
        location / {
            limit_req zone=dash_limit burst=20 nodelay;

            proxy_pass http://customer_portal;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_buffering off;

            proxy_next_upstream error timeout invalid_header http_502 http_503 http_504;
            proxy_next_upstream_tries 2;
            proxy_next_upstream_timeout 5s;

            proxy_read_timeout 600s;
        }
    }

    # ══════════════════════════════════════════════════════════════════════
    # ADMIN SERVER — admin.domain.com
    # ══════════════════════════════════════════════════════════════════════
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name ~^admin\.;

        ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        add_header X-Frame-Options SAMEORIGIN always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;

        # ── / — OmniRoute Admin Dashboard ──
        location / {
            limit_req zone=dash_limit burst=20 nodelay;

            proxy_pass http://omniroute_dashboard;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_next_upstream error timeout invalid_header http_502 http_503 http_504;
            proxy_next_upstream_tries 2;
            proxy_next_upstream_timeout 5s;

            proxy_buffering off;
            proxy_cache off;
            proxy_read_timeout 600s;
        }
    }
}
```

### How the Swap Works

The deploy script swaps the `down` marker between blue and green servers:

```bash
# Before deploy (BLUE active):
#   server 127.0.0.1:20128;               # BLUE — serving
#   server 127.0.0.1:20138 down;           # GREEN — standby

# After deploy (GREEN active):
#   server 127.0.0.1:20128 down;           # BLUE — standby
#   server 127.0.0.1:20138;               # GREEN — serving
```

The script uses `sed` to toggle `down`:

```bash
# Swap to GREEN
sudo sed -i 's/server 127.0.0.1:20128;/server 127.0.0.1:20128 down;/' /etc/nginx/nginx.conf
sudo sed -i 's/server 127.0.0.1:20138 down;/server 127.0.0.1:20138;/' /etc/nginx/nginx.conf
# Repeat for 20129/20139 and 3000/3001

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. Deploy Script — Blue-Green Orchestration

Here's the new [`deploy.sh`](deploy.sh) rewritten for blue-green. This replaces your current deploy script.

```bash
#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Blue-Green Zero-Downtime Deploy
# ══════════════════════════════════════════════════════════════════════════════
#
#  Usage:
#    ./deploy.sh                          # Deploy with default options
#    IMAGE_TAG=abc123 ./deploy.sh         # Deploy specific image tag
#    ACTIVE_SLOT=blue ./deploy.sh         # Override slot detection
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.unified.yml"
ENV_FILE="${SCRIPT_DIR}/.env"
NGINX_CONF="/etc/nginx/nginx.conf"
NGINX_SOURCE="${SCRIPT_DIR}/nginx/nginx.conf"

IMAGE_TAG="${IMAGE_TAG:-latest}"
export IMAGE_TAG

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo -e "${CYAN}${BOLD}═══ AI Platform — Blue-Green Deploy ═══${NC}"
echo ""

# ── Pre-flight checks ──
[[ -f "${ENV_FILE}" ]] || error ".env not found."
[[ -f "${COMPOSE_FILE}" ]] || error "docker-compose.unified.yml not found."
docker compose version &>/dev/null || error "Docker Compose not found."

# ── Detect current active slot ──
# Read from .env or detect from nginx config
ACTIVE_SLOT="${ACTIVE_SLOT:-$(grep "^ACTIVE_SLOT=" "${ENV_FILE}" | cut -d= -f2-)}"
if [[ -z "${ACTIVE_SLOT}" ]]; then
    # Detect from nginx: which upstream is NOT marked "down"?
    if sudo grep -q "server 127.0.0.1:20128;" "${NGINX_CONF}" 2>/dev/null && \
       ! sudo grep -q "server 127.0.0.1:20128 down;" "${NGINX_CONF}" 2>/dev/null; then
        ACTIVE_SLOT="blue"
    elif sudo grep -q "server 127.0.0.1:20138;" "${NGINX_CONF}" 2>/dev/null && \
         ! sudo grep -q "server 127.0.0.1:20138 down;" "${NGINX_CONF}" 2>/dev/null; then
        ACTIVE_SLOT="green"
    else
        ACTIVE_SLOT="blue"  # default
    fi
fi

if [[ "${ACTIVE_SLOT}" == "blue" ]]; then
    TARGET_SLOT="green"
    ACTIVE_PREFIX="blue"
    TARGET_PREFIX="green"
    ACTIVE_PORTS="20128/20129/3000"
    TARGET_PORTS="20138/20139/3001"
else
    TARGET_SLOT="blue"
    ACTIVE_PREFIX="green"
    TARGET_PREFIX="blue"
    ACTIVE_PORTS="20138/20139/3001"
    TARGET_PORTS="20128/20129/3000"
fi

info "Active slot: ${ACTIVE_SLOT^^} (ports ${ACTIVE_PORTS})"
info "Target slot: ${TARGET_SLOT^^} (ports ${TARGET_PORTS})"

# ── Sync OmniRoute .env (unchanged from current script) ──
# ... (keep your existing sync_env_var logic here) ...

# ── Pull pre-built images ──
info "Pulling images from GHCR (tag: ${IMAGE_TAG})..."
IMAGE_TAG="${IMAGE_TAG}" docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" pull
log "Images pulled"

# ── Run database migrations (idempotent, backward-compatible) ──
info "Running database migrations..."
if docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" run --no-deps --rm \
    customer-portal-${ACTIVE_PREFIX} \
    sh -c "node node_modules/prisma/build/index.js migrate deploy"; then
    log "Migrations applied"
    info "Running database seed..."
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" run --no-deps --rm \
        customer-portal-${ACTIVE_PREFIX} \
        sh -c "node node_modules/prisma/build/index.js db seed" || warn "Seed failed (non-fatal)"
else
    warn "Migration failed! Manual inspection required."
fi

# ── Step 1: Stop TARGET OmniRoute (if running) to free the volume ──
if docker ps --format '{{.Names}}' | grep -q "omniroute-${TARGET_PREFIX}"; then
    info "Stopping existing ${TARGET_SLOT^^} OmniRoute..."
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" stop "omniroute-${TARGET_PREFIX}"
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" rm -f "omniroute-${TARGET_PREFIX}"
fi

# ── Step 2: Copy SQLite data from ACTIVE to TARGET volume ──
info "Copying SQLite data from ${ACTIVE_SLOT^^} to ${TARGET_SLOT^^}..."
VOLUME_SRC="ai-omniroute-data"
VOLUME_DST="ai-omniroute-data-green"
if [[ "${TARGET_SLOT}" == "blue" ]]; then
    VOLUME_SRC="ai-omniroute-data-green"
    VOLUME_DST="ai-omniroute-data"
fi

# Copy using an Alpine container
docker run --rm \
    -v "${VOLUME_SRC}:/src:ro" \
    -v "${VOLUME_DST}:/dst" \
    alpine sh -c "rm -rf /dst/* && cp -a /src/. /dst/"
log "SQLite data copied"

# ── Step 3: Start TARGET environment ──
info "Starting ${TARGET_SLOT^^} environment..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d \
    "omniroute-${TARGET_PREFIX}" "customer-portal-${TARGET_PREFIX}"

# ── Step 4: Wait for health checks ──
wait_for_health() {
    local container_name="$1"
    local max_attempts="$2"
    info "Waiting for ${container_name} to be healthy..."
    local attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        local status=$(docker inspect --format '{{json .State.Health.Status}}' "${container_name}" 2>/dev/null | tr -d '"')
        if [[ "${status}" == "healthy" ]]; then
            log "${container_name} is healthy!"
            return 0
        elif [[ "${status}" == "unhealthy" ]]; then
            error "${container_name} is UNHEALTHY — aborting deploy!"
        fi
        if [[ -z "${status}" ]]; then
            local running=$(docker inspect --format '{{.State.Running}}' "${container_name}" 2>/dev/null)
            if [[ "${running}" != "true" ]]; then
                error "${container_name} failed to start"
            fi
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
    error "${container_name} not healthy within ${max_attempts} attempts"
}

wait_for_health "omniroute-${TARGET_PREFIX}" 30
wait_for_health "customer-portal-${TARGET_PREFIX}" 15

# ── Step 5: Verify target endpoints respond correctly ──
verify_endpoint() {
    local port="$1"
    local path="$2"
    local desc="$3"
    local code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:${port}${path}" 2>/dev/null || echo "000")
    if [[ "${code}" =~ ^(200|302|307|308|401)$ ]]; then
        log "${desc} (port ${port}) — HTTP ${code}"
    else
        error "${desc} (port ${port}) returned HTTP ${code} — aborting!"
    fi
}

if [[ "${TARGET_SLOT}" == "green" ]]; then
    verify_endpoint 20138 "/" "OmniRoute Dashboard (Green)"
    verify_endpoint 20139 "/v1/models" "OmniRoute API (Green)"
    verify_endpoint 3001 "/api/health" "Customer Portal (Green)"
else
    verify_endpoint 20128 "/" "OmniRoute Dashboard (Blue)"
    verify_endpoint 20129 "/v1/models" "OmniRoute API (Blue)"
    verify_endpoint 3000 "/api/health" "Customer Portal (Blue)"
fi

# ── Step 6: Swap nginx upstream to TARGET ──
info "Swapping nginx upstream to ${TARGET_SLOT^^}..."

# Backup current nginx config
sudo cp "${NGINX_CONF}" "${NGINX_CONF}.pre-deploy"

# Swap ALL upstream server entries
# BLUE up → down, GREEN down → up (or vice versa)
if [[ "${TARGET_SLOT}" == "green" ]]; then
    # Blue → down, Green → up
    sudo sed -i 's/server 127.0.0.1:20128;/server 127.0.0.1:20128 down;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:20138 down;/server 127.0.0.1:20138;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:20129;/server 127.0.0.1:20129 down;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:20139 down;/server 127.0.0.1:20139;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:3000;/server 127.0.0.1:3000 down;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:3001 down;/server 127.0.0.1:3001;/' "${NGINX_CONF}"
else
    # Green → down, Blue → up
    sudo sed -i 's/server 127.0.0.1:20138;/server 127.0.0.1:20138 down;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:20128 down;/server 127.0.0.1:20128;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:20139;/server 127.0.0.1:20139 down;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:20129 down;/server 127.0.0.1:20129;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:3001;/server 127.0.0.1:3001 down;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:3000 down;/server 127.0.0.1:3000;/' "${NGINX_CONF}"
fi

# Test nginx config
if sudo nginx -t; then
    sudo systemctl reload nginx
    log "Nginx reloaded — traffic now routed to ${TARGET_SLOT^^}"
    sudo rm -f "${NGINX_CONF}.pre-deploy"
else
    warn "Nginx config test FAILED! Restoring pre-deploy config."
    sudo cp "${NGINX_CONF}.pre-deploy" "${NGINX_CONF}"
    sudo systemctl reload nginx || true
    error "Nginx swap failed — deploy aborted. Previous config restored."
fi

# ── Step 7: Update ACTIVE_SLOT in .env ──
sed -i "s/^ACTIVE_SLOT=.*/ACTIVE_SLOT=${TARGET_SLOT}/" "${ENV_FILE}" 2>/dev/null || \
    echo "ACTIVE_SLOT=${TARGET_SLOT}" >> "${ENV_FILE}"

# ── Step 8: Stop old environment (optional, after a drain period) ──
# Uncomment the following lines to immediately stop the old environment.
# Or keep it running for instant rollback (recommended).
#
# info "Stopping old ${ACTIVE_SLOT^^} environment..."
# docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" stop \
#     "omniroute-${ACTIVE_PREFIX}" "customer-portal-${ACTIVE_PREFIX}"

info "Old ${ACTIVE_SLOT^^} environment left running for rollback readiness."
info "Run './deploy.sh cleanup' to stop it when confident."

# ── Step 9: Cleanup ──
docker image prune -f 2>/dev/null || true

# ── Post-deploy confirmation ──
echo ""
docker compose -f "${COMPOSE_FILE}" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
log "Blue-green deploy complete! ${TARGET_SLOT^^} is now active."
echo ""
```

---

## 8. Rollback Procedure

### Automated Rollback

```bash
# scripts/blue-green-rollback.sh
#!/usr/bin/env bash
# Reverses the last blue-green swap

set -euo pipefail

NGINX_CONF="/etc/nginx/nginx.conf"
ENV_FILE="/home/stevenleblanc62920/ai-platform/.env"

# Detect current active slot
ACTIVE_SLOT=$(grep "^ACTIVE_SLOT=" "${ENV_FILE}" | cut -d= -f2-)

if [[ "${ACTIVE_SLOT}" == "blue" ]]; then
    ROLLBACK_SLOT="green"
else
    ROLLBACK_SLOT="blue"
fi

echo "Rolling back from ${ACTIVE_SLOT^^} to ${ROLLBACK_SLOT^^}..."

# Swap nginx back
if [[ "${ROLLBACK_SLOT}" == "green" ]]; then
    sudo sed -i 's/server 127.0.0.1:20128;/server 127.0.0.1:20128 down;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:20138 down;/server 127.0.0.1:20138;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:20129;/server 127.0.0.1:20129 down;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:20139 down;/server 127.0.0.1:20139;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:3000;/server 127.0.0.1:3000 down;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:3001 down;/server 127.0.0.1:3001;/' "${NGINX_CONF}"
else
    sudo sed -i 's/server 127.0.0.1:20138;/server 127.0.0.1:20138 down;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:20128 down;/server 127.0.0.1:20128;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:20139;/server 127.0.0.1:20139 down;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:20129 down;/server 127.0.0.1:20129;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:3001;/server 127.0.0.1:3001 down;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:3000 down;/server 127.0.0.1:3000;/' "${NGINX_CONF}"
fi

sudo nginx -t && sudo systemctl reload nginx

# Update .env
sed -i "s/^ACTIVE_SLOT=.*/ACTIVE_SLOT=${ROLLBACK_SLOT}/" "${ENV_FILE}"

echo "Rollback complete. ${ROLLBACK_SLOT^^} is now active."
```

### Manual Rollback Scenarios

| Scenario | Action |
|----------|--------|
| **Green fails health check** | Deploy script aborts before nginx swap. BLUE still serving. No action needed. |
| **Green healthy but errors spike** | Run `./scripts/blue-green-rollback.sh` to swap nginx back to BLUE. |
| **Green has bug, need to revert** | Run rollback script. BLUE is still running (we left it up). Traffic switches instantly. |
| **Database migration broke schema** | Run `./manage.sh restore <backup-file>` to restore DB from backup, then rollback script. |
| **Everything broken** | `docker compose down && docker compose up -d` — starts BLUE environment from saved images. |

---

## 9. Migration Playbook: Moving from Old VPS to New VPS

This is the step-by-step plan for your actual VPS migration.

### Phase 1: Pre-Migration (2-3 days before)

```bash
# 1. Complete a full backup on the OLD VPS
cd /home/stevenleblanc62920/ai-platform
./manage.sh backup

# 2. Verify backup file exists
ls -la backups/backup_*.tar.gz

# 3. Create a PostgreSQL dump from Cloud SQL
pg_dump "${DATABASE_URL}" > ~/ai-platform-db-$(date +%Y%m%d).sql

# 4. Export Redis data (snapshot)
redis-cli -h <memorystore-host> -a <password> --rdb ~/redis-dump-$(date +%Y%m%d).rdb

# 5. Copy .env (secrets)
cp .env ~/ai-platform-env-backup.txt

# 6. Copy the backup files off the server for safety
# (SCP to your local machine or another secure location)
```

### Phase 2: New VPS Setup (1 day before)

```bash
# 1. Set up the new GCP VPS (Section 2.1)
# 2. Install Docker, Nginx, Node.js, Certbot
# 3. Set up Cloud SQL + Memorystore in the NEW GCP account (Sections 2.2, 2.3)
# 4. Clone the repo on the NEW VPS
git clone https://github.com/aikomputeapi-web/ai-platform.git
cd ai-platform

# 5. Set up SSL certificates
sudo certbot --nginx -d aikompute.com -d admin.aikompute.com

# 6. Create .env with new Cloud SQL/Memorystore credentials
# (use the same OmniRoute secrets as old VPS)
cp .env.unified.example .env
nano .env  # Fill in all values
```

### Phase 3: Data Migration (morning of cutover)

```bash
# 1. On OLD VPS: Stop the platform to ensure data consistency
cd /home/stevenleblanc62920/ai-platform
docker compose -f docker-compose.unified.yml down

# 2. On OLD VPS: Create final backup
./manage.sh backup

# 3. Copy the OmniRoute SQLite volume data to the NEW VPS
# (SCP the backup file, or use a direct transfer)
# On NEW VPS:
scp old-vps:/home/stevenleblanc62920/ai-platform/backups/backup_*.tar.gz ./backups/

# 4. Restore the backup on NEW VPS
./manage.sh restore ./backups/backup_<latest>.tar.gz

# 5. Restore PostgreSQL to new Cloud SQL
pg_dump "<old-database-url>" | psql "<new-database-url>"

# 6. Verify data integrity
# Check user accounts, subscriptions, etc.
```

### Phase 4: Cutover (zero-downtime window)

```bash
# 1. Set DNS TTL to 60 seconds (already done 24h ago)
# 2. Update DNS A record to point to NEW VPS IP
# 3. Wait 60-300 seconds for DNS propagation
# 4. Verify traffic is flowing to new VPS:
curl https://aikompute.com/api/health
curl https://admin.aikompute.com/api/health

# 5. Monitor logs for errors
docker compose -f docker-compose.unified.yml logs -f --tail 50

# 6. Once confirmed, stop the old VPS
# (or keep it running for 24h as fallback)
```

### Phase 5: Post-Migration (after cutover)

```bash
# 1. Update ACTIVE_SLOT in .env
echo "ACTIVE_SLOT=blue" >> .env

# 2. Set up blue-green infrastructure (this guide)
# 3. Create green services
docker compose -f docker-compose.unified.yml up -d omniroute-green customer-portal-green

# 4. Verify green is healthy
curl http://127.0.0.1:20138/api/health
curl http://127.0.0.1:3001/api/health

# 5. Stop green (will be used on next deploy)
docker compose -f docker-compose.unified.yml stop omniroute-green customer-portal-green

# 6. First blue-green deploy test:
./deploy.sh
```

---

## 10. Operation Runbook

### Normal Deploy

```bash
# 1. Push code to GitHub (GitHub Actions builds images and pushes to GHCR)
# 2. SSH into the VPS
# 3. Run deploy:
cd /home/stevenleblanc62920/ai-platform
./deploy.sh

# What happens:
#   - Pulls new images from GHCR
#   - Runs database migrations
#   - Copies SQLite from BLUE to GREEN volume
#   - Starts GREEN containers on alternate ports
#   - Waits for health checks
#   - Swaps nginx upstream to GREEN
#   - BLUE is left running (for rollback)
```

### Emergency Deploy (skip tests, fast)

```bash
IMAGE_TAG=abc123 FORCE=true ./deploy.sh
# (Add logic to skip health check verification for emergency fixes)
```

### Check Which Slot Is Active

```bash
cat .env | grep ACTIVE_SLOT
# Or:
sudo grep -n "server 127.0.0.1:" /etc/nginx/nginx.conf | grep -v "down"
```

### Monitor Both Environments

```bash
# Add to manage.sh:
cmd_blue_green_status() {
    echo -e "${BOLD}Blue-Green Status:${NC}"
    echo "Active: $(grep '^ACTIVE_SLOT=' .env | cut -d= -f2)"
    echo ""
    echo "Blue (ports 20128/3000):"
    curl -so /dev/null -w "  Dashboard: %{http_code}\n" http://127.0.0.1:20128/ 2>/dev/null || echo "  Dashboard: DOWN"
    curl -so /dev/null -w "  Portal: %{http_code}\n" http://127.0.0.1:3000/api/health 2>/dev/null || echo "  Portal: DOWN"
    echo ""
    echo "Green (ports 20138/3001):"
    curl -so /dev/null -w "  Dashboard: %{http_code}\n" http://127.0.0.1:20138/ 2>/dev/null || echo "  Dashboard: DOWN"
    curl -so /dev/null -w "  Portal: %{http_code}\n" http://127.0.0.1:3001/api/health 2>/dev/null || echo "  Portal: DOWN"
}
```

### Cleanup Old Environment

```bash
# Once you're confident the new environment is stable (24h+):
# scripts/blue-green-cleanup.sh
docker compose -f docker-compose.unified.yml stop omniroute-blue customer-portal-blue
docker compose -f docker-compose.unified.yml rm -f omniroute-blue customer-portal-blue
docker volume rm ai-omniroute-data
```

---

## 11. Long-Term: SQLite-to-PostgreSQL Migration

The current blue-green approach works around OmniRoute's SQLite limitation by copying volumes. This is a pragmatic solution, but the **real fix** is to migrate OmniRoute from SQLite to PostgreSQL — the same Cloud SQL instance your customer portal already uses.

### Why

| Current (SQLite + volume copy) | Future (PostgreSQL) |
|--------------------------------|---------------------|
| 5-10 second volume copy per deploy | Zero copy — database is always available |
| 5-10 second downtime during switch | True zero downtime |
| SQLite locked to single process | Multiple instances can read/write simultaneously |
| Volume corruption risk on copy | ACID guarantees from PostgreSQL |
| 1.5 GB data transfer every deploy | No data transfer needed |
| Can't scale to multiple servers | Full horizontal scaling |

### Migration Strategy

This is a significant undertaking (estimated 4-8 weeks) but eliminates the SQLite constraint entirely:

1. **Add PostgreSQL support to OmniRoute** — Create a new database adapter alongside the existing SQLite adapter
2. **Dual-write mode** — Run both SQLite and PostgreSQL in parallel for a transition period
3. **Data migration** — Copy all data from SQLite to PostgreSQL
4. **Cutover** — Switch OmniRoute to use PostgreSQL exclusively
5. **Remove SQLite** — Clean up volume management logic

### What Changes in OmniRoute

| File | Change |
|------|--------|
| `src/lib/db/core.ts` | Database connection: choose between SQLite (`better-sqlite3`) and PostgreSQL (`pg`) |
| 83 domain modules in `src/lib/db/` | Each module's SQL queries need PostgreSQL-compatible versions |
| Migration system | 97 migration files would need PostgreSQL equivalents |
| `docker-compose.unified.yml` | Remove volume copy logic, add Cloud SQL connection to OmniRoute |

### Recommendation

**Implement Phase 1 (this guide) immediately** — it solves zero downtime for your VPS migration and upcoming deployments. The volume-copy approach is safe, proven, and requires no OmniRoute code changes.

**Plan Phase 3 (SQLite → PostgreSQL) as a separate project** — it's the right long-term solution but shouldn't block your immediate migration needs. The blue-green scripts you set up now will work even after PostgreSQL migration; you'll just be able to remove the volume-copy step.

---

## Summary: What You Need to Do

### For the VPS Migration (This Week)

| Step | Description | Time |
|------|-------------|------|
| 1 | Set up new GCP account, VPS, Cloud SQL, Memorystore | 2-3 hours |
| 2 | Clone repo, install Docker/Nginx/Certbot, configure SSL | 1 hour |
| 3 | Create `.env` with new database credentials | 30 min |
| 4 | Backup old VPS (SQLite volume, PostgreSQL dump, Redis dump, `.env`) | 30 min |
| 5 | Restore data on new VPS | 1 hour |
| 6 | Test the platform on the new VPS (internal IP only) | 2 hours |
| 7 | Cut over DNS → monitor → decommission old VPS | 1 hour |

### For Blue-Green Deployment (After Migration)

| Step | Description | Time |
|------|-------------|------|
| 1 | Add green service definitions to `docker-compose.unified.yml` | 30 min |
| 2 | Update `nginx/nginx.conf` with dual upstream entries | 30 min |
| 3 | Rewrite `deploy.sh` for blue-green orchestration | 2 hours |
| 4 | Create `scripts/blue-green-rollback.sh` | 30 min |
| 5 | Update `manage.sh` with blue-green status commands | 30 min |
| 6 | Test blue-green deploy in isolation | 1 hour |
| 7 | First production blue-green deploy | 30 min |

**Total one-time effort: ~1-2 days** for the blue-green setup (includes rewriting files). The migration itself is ~1 day.
