# Staging Environment

## Overview

The staging environment runs the full AI Platform stack (OmniRoute, Customer Portal, PostgreSQL, Redis, CLIProxyAPI) on a **dedicated staging server**, completely isolated from production.

| | Production Server | Staging Server |
|---|---|---|
| **Branch** | `main` | `staging` |
| **Domain** | `aikompute.com` | `aikompute.indevs.in` |
| **Admin** | `admin.aikompute.com` | `admin.aikompute.indevs.in` |
| **Portal port (public)** | 443 ➔ container 3000 | 443 ➔ container 3301 |
| **Dashboard port (public)** | 443 (admin subdomain) ➔ 20128 | 443 (admin subdomain) ➔ 22028 |
| **Postgres port (internal)** | 5432 | 55432 |
| **Redis port (internal)** | 6379 | 56379 |
| **Docker project** | (default) | `aikompute-staging` |
| **Network** | `ai-platform-network` | `ai-staging-network` |
| **Volumes** | `ai-*-data` | `ai-*-data-staging` |

---

## Quick Start

### Setup a new staging server

1. Provision an Ubuntu VM.
2. Point DNS A records for `aikompute.indevs.in` and `admin.aikompute.indevs.in` to the new VM IP.
3. Clone this repository onto the new server under `~/ai-platform-staging` and switch to the `staging` branch.
4. Run the staging setup script:
   ```bash
   chmod +x setup-staging.sh deploy-staging.sh manage-staging.sh
   sudo ./setup-staging.sh
   ```

### Deploy staging manually (subsequent updates)

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
| `setup-staging.sh` | One-command staging server installation & setup |
| `deploy-staging.sh` | Build & deploy staging stack |
| `manage-staging.sh` | Day-to-day staging management |
| `.github/workflows/deploy-staging.yml` | CI/CD for staging branch |
| `nginx/nginx.staging.conf` | Dedicated staging Nginx configuration |

---

## Required GitHub Actions Secrets

Before the **Deploy to Staging** CI workflow can run, the following repository secrets must be set under **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `STAGING_SERVER_HOST` | IP or hostname of the staging server |
| `STAGING_SERVER_USER` | SSH user (e.g. `ubuntu` or `root`) |
| `STAGING_SERVER_SSH_KEY` | Private SSH key with access to the staging server |

> **Important:** The CI workflow clones into `~/ai-platform-staging` on the staging server. Run `setup-staging.sh` first to create and configure this directory. Without it, the very first CI deploy will fail with a "no such directory" error.

---


The staging environment is mapped to the domain `aikompute.indevs.in` and `admin.aikompute.indevs.in`.

### SSL Certificate

The staging setup script (`setup-staging.sh`) automatically provisions and renews Let's Encrypt certificates specifically for your staging domain (`aikompute.indevs.in` and `admin.aikompute.indevs.in`). The deployment script (`deploy-staging.sh`) automatically configures the staging Nginx server block to use these certificates.

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
Since staging runs on its own dedicated server, there are no port conflicts with production.

### Staging touching production data
This should never happen — staging has its own Docker network and volumes. Verify with:
```bash
docker network ls | grep -E "platform|staging"
docker volume ls | grep -E "staging"
```
