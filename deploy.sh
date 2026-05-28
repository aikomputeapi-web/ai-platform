#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Deploy (pull & rebuild)
# ══════════════════════════════════════════════════════════════════════════════
#
#  Called by GitHub Actions CI/CD on every push to main.
#  Can also be run manually:  ./deploy.sh
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.unified.yml"
ENV_FILE="${SCRIPT_DIR}/.env"
LAST_DEPLOYED_FILE="${SCRIPT_DIR}/.last_deployed_commit"

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

# ── Sync OmniRoute .env secrets helper ──
sync_env_var() {
    local key="$1"
    local val="$2"
    local file="$3"
    
    export TEMP_SYNC_VAL="${val}"
    node -e "
        const fs = require('fs');
        let content = fs.readFileSync('${file}', 'utf8');
        const key = '${key}';
        const val = process.env.TEMP_SYNC_VAL;
        const regex = new RegExp('^' + key + '=.*', 'm');
        if (content.match(regex)) {
            content = content.replace(regex, key + '=' + val);
        } else {
            content += '\n' + key + '=' + val;
        }
        fs.writeFileSync('${file}', content);
    "
    unset TEMP_SYNC_VAL
}

# ── Sync OmniRoute .env secrets ──
if [[ -f "./OmniRoute/.env.example" ]] && [[ -f "./OmniRoute/.env" ]]; then
    JWT=$(grep "^OMNIROUTE_JWT_SECRET=" "${ENV_FILE}" | cut -d= -f2-)
    API_KEY=$(grep "^OMNIROUTE_API_KEY_SECRET=" "${ENV_FILE}" | cut -d= -f2-)
    STORAGE_KEY=$(grep "^OMNIROUTE_STORAGE_ENCRYPTION_KEY=" "${ENV_FILE}" | cut -d= -f2-)
    ADMIN_PASS=$(grep "^OMNIROUTE_INITIAL_PASSWORD=" "${ENV_FILE}" | cut -d= -f2-)
    PUBLIC=$(grep "^PUBLIC_URL=" "${ENV_FILE}" | cut -d= -f2-)

    sync_env_var "JWT_SECRET" "${JWT}" "./OmniRoute/.env"
    sync_env_var "API_KEY_SECRET" "${API_KEY}" "./OmniRoute/.env"
    sync_env_var "STORAGE_ENCRYPTION_KEY" "${STORAGE_KEY}" "./OmniRoute/.env"
    sync_env_var "INITIAL_PASSWORD" "${ADMIN_PASS}" "./OmniRoute/.env"
    sync_env_var "NEXT_PUBLIC_BASE_URL" "${PUBLIC}" "./OmniRoute/.env"
    sync_env_var "BASE_URL" "${PUBLIC}" "./OmniRoute/.env"

    log "OmniRoute .env synced"
fi

# ── Check what changed to decide rebuild scope ──
CHANGED_FILES="unknown"
if [[ -f "${LAST_DEPLOYED_FILE}" ]]; then
    LAST_COMMIT=$(cat "${LAST_DEPLOYED_FILE}")
    if git cat-file -e "${LAST_COMMIT}" 2>/dev/null; then
        CHANGED_FILES=$(git diff --name-only "${LAST_COMMIT}" HEAD 2>/dev/null || echo "unknown")
    else
        CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "unknown")
    fi
else
    CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "unknown")
fi

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

# ── Image Tagging for Rollbacks ──
info "Creating image backups for rollback security..."
docker tag omniroute:cli omniroute:backup 2>/dev/null || true
docker tag customer-portal:latest customer-portal:backup 2>/dev/null || true

# ── Build only what changed ──
cd "${SCRIPT_DIR}"

if [[ "${NEEDS_OMNIROUTE_BUILD}" == "true" ]] || [[ "${NEEDS_PORTAL_BUILD}" == "true" ]]; then
    SERVICES=""
    # Building base image triggers both instances
    [[ "${NEEDS_OMNIROUTE_BUILD}" == "true" ]] && SERVICES="${SERVICES} omniroute-1" && info "OmniRoute changed — rebuilding image"
    [[ "${NEEDS_PORTAL_BUILD}" == "true" ]] && SERVICES="${SERVICES} customer-portal-1" && info "Customer Portal changed — rebuilding image"

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

# ── Helper: Rollback and Exit ──
rollback_and_exit() {
    local failed_svc="$1"
    warn "Rollback triggered due to deploy failure on: ${failed_svc}"
    
    # Restore backups if they exist
    if docker image inspect omniroute:backup &>/dev/null; then
        docker tag omniroute:backup omniroute:cli
    fi
    if docker image inspect customer-portal:backup &>/dev/null; then
        docker tag customer-portal:backup customer-portal:latest
    fi

    info "Restoring stable backups to all instances..."
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --force-recreate omniroute-1 omniroute-2 customer-portal-1 customer-portal-2
    
    error "Deploy failed on ${failed_svc}. Reverted to previous stable version."
}

# ── Helper: Wait for Healthcheck ──
wait_for_health() {
    local container_name="$1"
    info "Waiting for ${container_name} to be healthy..."
    local max_attempts=30
    local attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        local status=$(docker inspect --format '{{json .State.Health.Status}}' "${container_name}" 2>/dev/null | tr -d '"')
        if [[ "${status}" == "healthy" ]]; then
            log "${container_name} is healthy!"
            return 0
        elif [[ "${status}" == "unhealthy" ]]; then
            rollback_and_exit "${container_name}"
        fi
        
        # Fallback if status is empty
        if [[ -z "${status}" ]]; then
            local running=$(docker inspect --format '{{.State.Running}}' "${container_name}" 2>/dev/null)
            if [[ "${running}" != "true" ]]; then
                rollback_and_exit "${container_name}"
            fi
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
    rollback_and_exit "${container_name}"
}

# ── Helper: Rolling Update ──
roll_service_pair() {
    local svc_name_base="$1"
    local svc1="${svc_name_base}-1"
    local svc2="${svc_name_base}-2"

    info "Rolling update: restarting ${svc1}..."
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --no-deps --remove-orphans "${svc1}"
    wait_for_health "${svc1}"

    info "Rolling update: restarting ${svc2}..."
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --no-deps --remove-orphans "${svc2}"
    wait_for_health "${svc2}"
}

# ── Restart services ──
if [[ "${NEEDS_FULL_RESTART}" == "true" ]]; then
    info "Config changed — systematic rolling restart of all services"
    
    # 1. Update Core Cache layers
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d redis
    wait_for_health "ai-redis"

    # 2. Update Sidecar proxy API
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d cliproxyapi
    wait_for_health "cliproxyapi"

    # 3. Run database migrations once
    if [[ "${NEEDS_PORTAL_BUILD}" == "true" ]]; then
        info "Running database migrations..."
        docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" run --rm customer-portal-1 sh -c "node node_modules/prisma/build/index.js migrate deploy" || rollback_and_exit "database-migration"
    fi

    # 4. Roll gateways
    roll_service_pair "omniroute"
    roll_service_pair "customer-portal"

    # 5. Background workers
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d report-deliverer
    
elif [[ "${NEEDS_OMNIROUTE_BUILD}" == "true" ]] || [[ "${NEEDS_PORTAL_BUILD}" == "true" ]]; then
    # Run migrations if portal code changed
    if [[ "${NEEDS_PORTAL_BUILD}" == "true" ]]; then
        info "Running database migrations..."
        docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" run --rm customer-portal-1 sh -c "node node_modules/prisma/build/index.js migrate deploy" || rollback_and_exit "database-migration"
    fi

    if [[ "${NEEDS_OMNIROUTE_BUILD}" == "true" ]]; then
        roll_service_pair "omniroute"
    fi
    if [[ "${NEEDS_PORTAL_BUILD}" == "true" ]]; then
        roll_service_pair "customer-portal"
    fi
else
    info "No builds needed — doing rolling restart"
    roll_service_pair "omniroute"
    roll_service_pair "customer-portal"
fi

# ── Reload nginx if config changed ──
if echo "${CHANGED_FILES}" | grep -q "nginx/"; then
    info "Nginx config changed — reloading"
    DOMAIN=$(grep "^DOMAIN=" "${ENV_FILE}" | cut -d= -f2-)
    sudo cp "${SCRIPT_DIR}/nginx/nginx.conf" /etc/nginx/nginx.conf
    sudo sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" /etc/nginx/nginx.conf
    sudo nginx -t 2>/dev/null && sudo systemctl reload nginx && log "Nginx reloaded" || warn "Nginx reload failed"
fi

# ── Post-deploy confirmation ──
echo ""
docker compose -f "${COMPOSE_FILE}" ps --format "table {{.Name}}\t{{.Status}}"
echo ""

# Record successful deploy commit
git rev-parse HEAD > "${LAST_DEPLOYED_FILE}" 2>/dev/null || true

log "Deploy complete — all containers running and healthy!"
echo ""
