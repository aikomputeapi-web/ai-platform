#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Deploy Staging
# ══════════════════════════════════════════════════════════════════════════════
#
#  Called by GitHub Actions CI/CD on pushes to the staging branch.
#  Can also be run manually:  ./deploy-staging.sh
#
#  This deploys the staging stack using docker-compose.staging.yml overlay
#  with .env.staging, completely isolated from production.
#
#  Ports:
#    Customer Portal:    3301
#    OmniRoute Dashboard: 22028
#    OmniRoute API:       22029
#    PostgreSQL:          55432
#    Redis:               56379
#    CLIProxyAPI UI:      8185
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.unified.yml"
STAGING_FILE="${SCRIPT_DIR}/docker-compose.staging.yml"
ENV_FILE="${SCRIPT_DIR}/.env.staging"
PROJECT="aikompute-staging"

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }

dc() { docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -f "${STAGING_FILE}" -p "${PROJECT}" "$@"; }

echo ""
echo -e "${CYAN}${BOLD}═══ AI Platform — Staging Deploy ═══${NC}"
echo ""

# ── Pre-flight checks ──
[[ -f "${ENV_FILE}" ]] || error ".env.staging not found. Create it first."
[[ -f "${COMPOSE_FILE}" ]] || error "docker-compose.unified.yml not found."
[[ -f "${STAGING_FILE}" ]] || error "docker-compose.staging.yml not found."
docker compose version &>/dev/null || error "Docker Compose not found."

log "Environment OK"

# ── Sync OmniRoute .env.staging secrets ──
if [[ -f "./OmniRoute/.env.staging" ]]; then
    JWT=$(grep '^OMNIROUTE_JWT_SECRET=' "${ENV_FILE}" | cut -d= -f2-)
    API_KEY=$(grep '^OMNIROUTE_API_KEY_SECRET=' "${ENV_FILE}" | cut -d= -f2-)
    STORAGE_KEY=$(grep '^OMNIROUTE_STORAGE_ENCRYPTION_KEY=' "${ENV_FILE}" | cut -d= -f2-)
    ADMIN_PASS=$(grep '^OMNIROUTE_INITIAL_PASSWORD=' "${ENV_FILE}" | cut -d= -f2-)
    PUBLIC=$(grep '^PUBLIC_URL=' "${ENV_FILE}" | cut -d= -f2-)

    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" ./OmniRoute/.env.staging
    sed -i "s|^API_KEY_SECRET=.*|API_KEY_SECRET=${API_KEY}|" ./OmniRoute/.env.staging
    sed -i "s|^STORAGE_ENCRYPTION_KEY=.*|STORAGE_ENCRYPTION_KEY=${STORAGE_KEY}|" ./OmniRoute/.env.staging
    sed -i "s|^INITIAL_PASSWORD=.*|INITIAL_PASSWORD=${ADMIN_PASS}|" ./OmniRoute/.env.staging
    sed -i "s|^NEXT_PUBLIC_BASE_URL=.*|NEXT_PUBLIC_BASE_URL=${PUBLIC}|" ./OmniRoute/.env.staging
    sed -i "s|^BASE_URL=.*|BASE_URL=${PUBLIC}|" ./OmniRoute/.env.staging

    log "OmniRoute .env.staging synced"
fi

cd "${SCRIPT_DIR}"

# ── Build staging stack ──
info "Building staging stack"
set +e
dc build --parallel 2>&1
BUILD_RC=$?
set -e

if [[ $BUILD_RC -ne 0 ]]; then
    error "Build failed (exit ${BUILD_RC}). Check output above."
fi
log "Build complete"

# ── Start staging stack ──
info "Starting staging stack"
dc up -d --remove-orphans

# ── Update Nginx Configuration ──
info "Updating Nginx configuration..."
# Read staging domain
STAGING_ENV_FILE="${SCRIPT_DIR}/.env.staging"
if [[ -f "${STAGING_ENV_FILE}" ]]; then
    STAGING_DOMAIN=$(grep "^DOMAIN=" "${STAGING_ENV_FILE}" | cut -d= -f2-)
else
    STAGING_DOMAIN="aikompute.indevs.in"
fi

# Detect which SSL certificate directory to use
CERT_DOMAIN="${STAGING_DOMAIN}"
if [[ ! -d "/etc/letsencrypt/live/${CERT_DOMAIN}" ]]; then
    if [[ -d "/etc/letsencrypt/live/${STAGING_DOMAIN}-0001" ]]; then
        CERT_DOMAIN="${STAGING_DOMAIN}-0001"
    else
        FOUND_CERT=$(find /etc/letsencrypt/live/ -mindepth 1 -maxdepth 1 -type d -not -name "README" | head -n 1 || true)
        if [[ -n "${FOUND_CERT}" ]]; then
            CERT_DOMAIN=$(basename "${FOUND_CERT}")
        fi
    fi
fi
info "Using SSL certificate for domain: ${CERT_DOMAIN}"

# Prepare nginx config safely
TEMP_CONF="${SCRIPT_DIR}/nginx/nginx.conf.tmp"
cp "${SCRIPT_DIR}/nginx/nginx.staging.conf" "${TEMP_CONF}"

sed -i "s/STG_HOST_PLACEHOLDER/${STAGING_DOMAIN}/g" "${TEMP_CONF}"
sed -i "s/SSL_CERT_NAME_PLACEHOLDER/${CERT_DOMAIN}/g" "${TEMP_CONF}"

# Backup, copy, test, and reload
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak
sudo cp "${TEMP_CONF}" /etc/nginx/nginx.conf
rm -f "${TEMP_CONF}"

if sudo nginx -t; then
    sudo systemctl reload nginx
    log "Nginx reloaded successfully"
    sudo rm -f /etc/nginx/nginx.conf.bak
else
    warn "Nginx config test failed! Restoring backup config."
    sudo cp /etc/nginx/nginx.conf.bak /etc/nginx/nginx.conf
    sudo rm -f /etc/nginx/nginx.conf.bak
    sudo systemctl reload nginx
    error "Nginx deployment failed."
fi

# ── Wait and verify ──
info "Waiting for services..."
sleep 10

echo ""
dc ps --format "table {{.Name}}\t{{.Status}}"
echo ""

RUNNING=$(dc ps --status running -q 2>/dev/null | wc -l || echo 0)
TOTAL=$(dc ps -q 2>/dev/null | wc -l || echo 0)
EXITED=$(dc ps --status exited -q 2>/dev/null | wc -l || echo 0)

if [[ $EXITED -gt 0 ]]; then
    warn "${EXITED} container(s) exited. Showing logs:"
    for CID in $(dc ps --status exited -q 2>/dev/null); do
        CNAME=$(docker inspect --format '{{.Name}}' "$CID" | sed 's/^\///')
        echo -e "\n${YELLOW}── ${CNAME} ──${NC}"
        docker logs --tail 20 "$CID" 2>&1
    done
    error "Staging deploy completed with failures."
fi

log "Staging deploy complete — ${RUNNING}/${TOTAL} containers running"
echo ""
echo -e "${BOLD}Staging endpoints:${NC}"
echo "  Portal:    http://127.0.0.1:3301"
echo "  Dashboard: http://127.0.0.1:22028"
echo "  API:       http://127.0.0.1:22029"
echo ""
