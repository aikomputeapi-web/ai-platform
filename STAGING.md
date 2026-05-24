# Staging Environment

## Overview

The staging environment runs the full AI Platform stack (OmniRoute, Customer Portal, PostgreSQL, Redis, CLIProxyAPI) on the **same server** as production, but completely isolated: separate ports, volumes, network, containers, and secrets.

| | Production | Staging |
|---|---|---|
| **Branch** | `main` | `staging` |
| **Domain** | `aikompute.com` | `aikompute.indevs.in` |
| **Admin** | `admin.aikompute.com` | `admin.aikompute.indevs.in` |
| **Portal port** | 3000 | 3301 |
| **Dashboard port** | 20128 | 22028 |
| **API port** | 20129 | 22029 |
| **Postgres port** | 5432 | 55432 |
| **Redis port** | 6379 | 56379 |
| **CLIProxyAPI UI** | 8085 | 8185 |
| **Docker project** | (default) | `aikompute-staging` |
| **Network** | `ai-platform-network` | `ai-staging-network` |
| **Volumes** | `ai-*-data` | `ai-*-data-staging` |

---

## Quick Start

### Deploy staging manually

```bash
./deploy-staging.sh
```

### Manage staging

```bash
./manage-staging.sh status    # Service health
./manage-staging.sh logs      # Tail all logs
./manage-staging.sh restart   # Restart all
./manage-staging.sh rebuild   # Full rebuild
./manage-staging.sh health    # HTTP checks
./manage-staging.sh shell omniroute  # Enter container
```

---

## Development Workflow

### 1. Create a feature branch from staging

```bash
git checkout staging
git pull origin staging
git checkout -b feature/my-change
```

### 2. Make your changes

Edit code locally or on the server. If working on OmniRoute (submodule):

```bash
cd OmniRoute
# make changes
git add . && git commit -m "Describe change"
git push origin HEAD
cd ..
git add OmniRoute
git commit -m "Bump OmniRoute submodule"
```

### 3. Push to staging to test

```bash
git checkout staging
git merge feature/my-change
git push origin staging
```

This triggers the **Deploy to Staging** GitHub Action, which automatically:
1. SSHs into the server
2. Pulls the `staging` branch
3. Runs `./deploy-staging.sh`

### 4. Verify on staging

- **Portal**: https://aikompute.indevs.in
- **Admin Dashboard**: https://admin.aikompute.indevs.in
- **API**: `https://aikompute.indevs.in/v1/chat/completions`

```bash
# Quick health check
./manage-staging.sh health

# Check logs for errors
./manage-staging.sh logs omniroute
```

### 5. Promote to production

Once verified on staging:

```bash
git checkout main
git merge staging
git push origin main
```

This triggers the **Deploy to Production** GitHub Action.

---

## Files

| File | Purpose |
|---|---|
| `.env.staging` | Staging secrets (NEVER commit) |
| `OmniRoute/.env.staging` | OmniRoute staging env |
| `docker-compose.staging.yml` | Staging overlay (ports, volumes, network) |
| `deploy-staging.sh` | Build & deploy staging stack |
| `manage-staging.sh` | Day-to-day staging management |
| `.github/workflows/deploy-staging.yml` | CI/CD for staging branch |
| `nginx/nginx.conf` | Includes staging server blocks |

---

## DNS & SSL Setup

The staging environment is mapped to the domain `aikompute.indevs.in` and `admin.aikompute.indevs.in`.

### SSL Certificate

The server already has active, valid Let's Encrypt certificates configured for `aikompute.indevs.in` and `admin.aikompute.indevs.in`. The deployment script (`deploy-staging.sh`) automatically detects these certificates and configures Nginx accordingly.

---

## Troubleshooting

### Staging containers not starting
```bash
./manage-staging.sh logs      # Check for errors
docker compose --env-file .env.staging \
  -f docker-compose.unified.yml \
  -f docker-compose.staging.yml \
  -p aikompute-staging config  # Validate merged config
```

### Port conflicts with production
Staging uses completely different host ports. If you see bind errors, check that no other service is using ports 3301, 22028, 22029, 55432, 56379, or 8185.

### Staging touching production data
This should never happen — staging has its own Docker network and volumes. Verify with:
```bash
docker network ls | grep -E "platform|staging"
docker volume ls | grep -E "staging"
```
