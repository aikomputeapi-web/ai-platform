#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Deploy (pull & rebuild)
# ══════════════════════════════════════════════════════════════════════════════
#
#  Called by GitHub Actions CI/CD on every push to main.
#  Can also be run manually:  sudo ./deploy.sh
#
#  This does NOT re-run the full setup (no SSL, no OS tuning, no .env regen).
#  It only rebuilds and restarts the Docker containers.
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.unified.yml"
ENV_FILE="${SCRIPT_DIR}/.env"

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo -e "${CYAN}${BOLD}═══ AI Platform — Deploy ═══${NC}"
echo ""

# ── Pre-flight checks ──
[[ -f "${ENV_FILE}" ]] || error ".env not found. Run setup.sh first."
[[ -f "${COMPOSE_FILE}" ]] || error "docker-compose.unified.yml not found."
docker compose version &>/dev/null || error "Docker Compose not found."

log "Environment OK"

# ── Sync OmniRoute .env secrets ──
if [[ -f "./OmniRoute/.env.example" ]] && [[ -f "./OmniRoute/.env" ]]; then
    # Re-inject secrets from root .env into OmniRoute .env (preserves any manual edits to other fields)
    JWT=$(grep OMNIROUTE_JWT_SECRET "${ENV_FILE}" | cut -d= -f2-)
    API_KEY=$(grep OMNIROUTE_API_KEY_SECRET "${ENV_FILE}" | cut -d= -f2-)
    STORAGE_KEY=$(grep OMNIROUTE_STORAGE_ENCRYPTION_KEY "${ENV_FILE}" | cut -d= -f2-)
    ADMIN_PASS=$(grep OMNIROUTE_INITIAL_PASSWORD "${ENV_FILE}" | cut -d= -f2-)
    PUBLIC=$(grep PUBLIC_URL "${ENV_FILE}" | cut -d= -f2-)

    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" ./OmniRoute/.env
    sed -i "s|^API_KEY_SECRET=.*|API_KEY_SECRET=${API_KEY}|" ./OmniRoute/.env
    sed -i "s|^STORAGE_ENCRYPTION_KEY=.*|STORAGE_ENCRYPTION_KEY=${STORAGE_KEY}|" ./OmniRoute/.env
    sed -i "s|^INITIAL_PASSWORD=.*|INITIAL_PASSWORD=${ADMIN_PASS}|" ./OmniRoute/.env
    sed -i "s|^NEXT_PUBLIC_BASE_URL=.*|NEXT_PUBLIC_BASE_URL=${PUBLIC}|" ./OmniRoute/.env
    sed -i "s|^BASE_URL=.*|BASE_URL=${PUBLIC}|" ./OmniRoute/.env

    log "OmniRoute .env synced"
fi

# ── Check what changed to decide rebuild scope ──
# If only non-Docker files changed, a full rebuild is wasteful
CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "unknown")

NEEDS_OMNIROUTE_BUILD=false
NEEDS_PORTAL_BUILD=false
NEEDS_FULL_RESTART=false

if echo "${CHANGED_FILES}" | grep -q "^OmniRoute/"; then
    NEEDS_OMNIROUTE_BUILD=true
fi

if echo "${CHANGED_FILES}" | grep -q "^customer-portal/"; then
    NEEDS_PORTAL_BUILD=true
fi

if echo "${CHANGED_FILES}" | grep -q "docker-compose\|\.env\|nginx"; then
    NEEDS_FULL_RESTART=true
fi

# If we can't determine changes (first deploy, etc.), rebuild everything
if echo "${CHANGED_FILES}" | grep -q "unknown"; then
    NEEDS_OMNIROUTE_BUILD=true
    NEEDS_PORTAL_BUILD=true
    NEEDS_FULL_RESTART=true
fi

# ── Build only what changed ──
cd "${SCRIPT_DIR}"

if [[ "${NEEDS_OMNIROUTE_BUILD}" == "true" ]] || [[ "${NEEDS_PORTAL_BUILD}" == "true" ]]; then
    SERVICES=""
    [[ "${NEEDS_OMNIROUTE_BUILD}" == "true" ]] && SERVICES="${SERVICES} omniroute" && info "OmniRoute changed — rebuilding"
    [[ "${NEEDS_PORTAL_BUILD}" == "true" ]] && SERVICES="${SERVICES} customer-portal" && info "Customer Portal changed — rebuilding"

    set +e
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" build --parallel ${SERVICES} 2>&1
    BUILD_RC=$?
    set -e

    if [[ $BUILD_RC -ne 0 ]]; then
        error "Build failed (exit ${BUILD_RC}). Check output above."
    fi
    log "Build complete"
else
    info "No Docker images need rebuilding"
fi

# ── Restart services ──
if [[ "${NEEDS_FULL_RESTART}" == "true" ]]; then
    info "Config changed — full restart"
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans
elif [[ "${NEEDS_OMNIROUTE_BUILD}" == "true" ]] || [[ "${NEEDS_PORTAL_BUILD}" == "true" ]]; then
    info "Restarting changed services"
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans
else
    info "Restarting without rebuild"
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" restart
fi

# ── Reload nginx if config changed ──
if echo "${CHANGED_FILES}" | grep -q "nginx/"; then
    info "Nginx config changed — reloading"
    DOMAIN=$(grep "^DOMAIN=" "${ENV_FILE}" | cut -d= -f2-)
    cp "${SCRIPT_DIR}/nginx/nginx.conf" /etc/nginx/nginx.conf
    sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" /etc/nginx/nginx.conf
    nginx -t 2>/dev/null && systemctl reload nginx && log "Nginx reloaded" || warn "Nginx reload failed"
fi

# ── Wait and verify ──
info "Waiting for services..."
sleep 10

RUNNING=$(docker compose -f "${COMPOSE_FILE}" ps --status running -q 2>/dev/null | wc -l || echo 0)
TOTAL=$(docker compose -f "${COMPOSE_FILE}" ps -q 2>/dev/null | wc -l || echo 0)
EXITED=$(docker compose -f "${COMPOSE_FILE}" ps --status exited -q 2>/dev/null | wc -l || echo 0)

echo ""
docker compose -f "${COMPOSE_FILE}" ps --format "table {{.Name}}\t{{.Status}}"
echo ""

if [[ $EXITED -gt 0 ]]; then
    warn "${EXITED} container(s) exited. Showing logs:"
    for CID in $(docker compose -f "${COMPOSE_FILE}" ps --status exited -q 2>/dev/null); do
        CNAME=$(docker inspect --format '{{.Name}}' "$CID" | sed 's/^\///')
        echo -e "\n${YELLOW}── ${CNAME} ──${NC}"
        docker logs --tail 20 "$CID" 2>&1
    done
    error "Deploy completed with failures."
fi

log "Deploy complete — ${RUNNING}/${TOTAL} containers running"
echo ""
