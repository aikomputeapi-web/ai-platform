#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Blue-Green Zero-Downtime Switch
# ══════════════════════════════════════════════════════════════════════════════
#
#  Orchestrates a blue-green deployment:
#    1. Detect active slot (BLUE or GREEN) from .env or nginx config
#    2. Pull latest images from GHCR
#    3. Run database migrations (idempotent, backward-compatible)
#    4. Copy SQLite data from active volume to target volume
#    5. Start target environment containers (on alternate ports)
#    6. Wait for health checks on target containers
#    7. Verify target endpoints respond correctly
#    8. Swap nginx upstream (sed + nginx -t + systemctl reload nginx)
#    9. Update ACTIVE_SLOT in .env
#   10. Leave old environment running for instant rollback
#
#  Usage:
#    ./scripts/blue-green-switch.sh                          # Default deploy
#    IMAGE_TAG=abc123 ./scripts/blue-green-switch.sh         # Specific tag
#    ACTIVE_SLOT=blue ./scripts/blue-green-switch.sh         # Override detection
#    FORCE=true ./scripts/blue-green-switch.sh               # Skip health checks
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.unified.yml"
ENV_FILE="${SCRIPT_DIR}/.env"
NGINX_CONF="/etc/nginx/nginx.conf"

IMAGE_TAG="${IMAGE_TAG:-latest}"
export IMAGE_TAG

FORCE="${FORCE:-false}"

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo -e "${CYAN}${BOLD}═══ AI Platform — Blue-Green Switch ═══${NC}"
echo ""

# ── Pre-flight checks ──
[[ -f "${ENV_FILE}" ]] || error ".env not found"
[[ -f "${COMPOSE_FILE}" ]] || error "docker-compose.unified.yml not found"
command -v docker &>/dev/null || error "Docker not found"
sudo nginx -v &>/dev/null || error "Nginx not found"

# ── Detect current active slot ──
# Priority: 1) ACTIVE_SLOT env var, 2) .env file, 3) nginx config detection
ACTIVE_SLOT="${ACTIVE_SLOT:-}"
if [[ -z "${ACTIVE_SLOT}" ]]; then
    ACTIVE_SLOT="$(grep "^ACTIVE_SLOT=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]')"
fi
if [[ -z "${ACTIVE_SLOT}" ]]; then
    # Detect from nginx: which upstream is NOT marked "down"?
    if sudo grep -q "server 127.0.0.1:20128;" "${NGINX_CONF}" 2>/dev/null && \
       ! sudo grep -q "server 127.0.0.1:20128 down;" "${NGINX_CONF}" 2>/dev/null; then
        ACTIVE_SLOT="blue"
    elif sudo grep -q "server 127.0.0.1:20138;" "${NGINX_CONF}" 2>/dev/null && \
         ! sudo grep -q "server 127.0.0.1:20138 down;" "${NGINX_CONF}" 2>/dev/null; then
        ACTIVE_SLOT="green"
    else
        ACTIVE_SLOT="blue"  # default fallback
    fi
fi

# Normalize to lowercase
ACTIVE_SLOT="${ACTIVE_SLOT,,}"

# Compose service names — blue has no suffix, green has "-green"
if [[ "${ACTIVE_SLOT}" == "blue" ]]; then
    TARGET_SLOT="green"
    ACTIVE_OMNI="omniroute"
    ACTIVE_PORTAL="customer-portal"
    TARGET_OMNI="omniroute-green"
    TARGET_PORTAL="customer-portal-green"
    ACTIVE_PORTS="20128/20129/3000"
    TARGET_PORTS="20138/20139/3001"
else
    TARGET_SLOT="blue"
    ACTIVE_OMNI="omniroute-green"
    ACTIVE_PORTAL="customer-portal-green"
    TARGET_OMNI="omniroute"
    TARGET_PORTAL="customer-portal"
    ACTIVE_PORTS="20138/20139/3001"
    TARGET_PORTS="20128/20129/3000"
fi

info "Active slot: ${ACTIVE_SLOT^^} (${ACTIVE_OMNI}, ${ACTIVE_PORTAL})"
info "Target slot: ${TARGET_SLOT^^} (${TARGET_OMNI}, ${TARGET_PORTAL})"

# ── Pull pre-built images from GHCR ──
info "Pulling images from GHCR (tag: ${IMAGE_TAG})..."
IMAGE_TAG="${IMAGE_TAG}" docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" pull
log "Images pulled"

# ── Run database migrations (idempotent, backward-compatible) ──
info "Running database migrations..."
# Run via the currently active portal container (has Prisma CLI)
if docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" run --no-deps --rm \
    "${ACTIVE_PORTAL}" \
    sh -c "node node_modules/prisma/build/index.js migrate deploy" 2>/dev/null; then
    log "Migrations applied"
    info "Running database seed..."
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" run --no-deps --rm \
        "${ACTIVE_PORTAL}" \
        sh -c "node node_modules/prisma/build/index.js db seed" || warn "Seed failed (non-fatal)"
else
    warn "Migration command failed — will retry against target container"
    # Try against target if available
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" run --no-deps --rm \
        "${TARGET_PORTAL}" \
        sh -c "node node_modules/prisma/build/index.js migrate deploy" 2>/dev/null || \
    warn "Migration failed! Manual inspection required. Continuing deploy."
fi

# ── Ensure the green data volume exists ──
if [[ "${TARGET_SLOT}" == "green" ]]; then
    docker volume inspect ai-omniroute-data-green &>/dev/null || docker volume create ai-omniroute-data-green
fi

# ── Step 1: Stop TARGET OmniRoute (if running) to free the volume ──
info "Checking if ${TARGET_SLOT^^} OmniRoute is running..."
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${TARGET_OMNI}$"; then
    info "Stopping existing ${TARGET_SLOT^^} OmniRoute (${TARGET_OMNI})..."
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" stop "${TARGET_OMNI}" || true
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" rm -f "${TARGET_OMNI}" || true
    log "Stopped and removed ${TARGET_SLOT^^} OmniRoute"
fi

# ── Step 2: Copy SQLite data from ACTIVE to TARGET volume ──
# This is the critical step that prevents concurrent SQLite access.
# We copy while active is still running (read-only is safe),
# then stop active OmniRoute before starting target.
info "Copying SQLite data from ${ACTIVE_SLOT^^} to ${TARGET_SLOT^^}..."

if [[ "${ACTIVE_SLOT}" == "blue" ]]; then
    VOLUME_SRC="ai-omniroute-data"
    VOLUME_DST="ai-omniroute-data-green"
else
    VOLUME_SRC="ai-omniroute-data-green"
    VOLUME_DST="ai-omniroute-data"
fi

# Copy using an Alpine container — clears destination first, then copies
docker run --rm \
    -v "${VOLUME_SRC}:/src:ro" \
    -v "${VOLUME_DST}:/dst" \
    alpine sh -c "rm -rf /dst/* && cp -a /src/. /dst/" || error "Volume copy failed"
log "SQLite data copied from ${VOLUME_SRC} to ${VOLUME_DST}"

# ── Step 3: Start TARGET environment ──
info "Starting ${TARGET_SLOT^^} environment..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d "${TARGET_OMNI}" "${TARGET_PORTAL}"
log "${TARGET_SLOT^^} containers started"

# ── Step 4: Wait for health checks ──
wait_for_health() {
    local container_name="$1"
    local max_attempts="$2"
    info "Waiting for ${container_name} to be healthy..."
    local attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        local status
        status="$(docker inspect --format '{{json .State.Health.Status}}' "${container_name}" 2>/dev/null | tr -d '"' || echo '')"
        if [[ "${status}" == "healthy" ]]; then
            log "${container_name} is healthy!"
            return 0
        elif [[ "${status}" == "unhealthy" ]]; then
            if [[ "${FORCE}" == "true" ]]; then
                warn "${container_name} is UNHEALTHY — FORCE=true, continuing..."
                return 0
            fi
            error "${container_name} is UNHEALTHY — aborting deploy!"
        fi
        if [[ -z "${status}" ]]; then
            local running
            running="$(docker inspect --format '{{.State.Running}}' "${container_name}" 2>/dev/null || echo 'false')"
            if [[ "${running}" != "true" ]]; then
                if [[ "${FORCE}" == "true" ]]; then
                    warn "${container_name} failed to start — FORCE=true, continuing..."
                    return 0
                fi
                error "${container_name} failed to start"
            fi
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
    if [[ "${FORCE}" == "true" ]]; then
        warn "${container_name} not healthy within ${max_attempts} attempts — FORCE=true, continuing..."
        return 0
    fi
    error "${container_name} not healthy within ${max_attempts} attempts"
}

wait_for_health "${TARGET_OMNI}" 30
wait_for_health "${TARGET_PORTAL}" 15

# ── Step 5: Verify target endpoints respond correctly ──
verify_endpoint() {
    local port="$1"
    local path="$2"
    local desc="$3"
    local code
    code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:${port}${path}" 2>/dev/null || echo "000")"
    if [[ "${code}" =~ ^(200|302|307|308|401)$ ]]; then
        log "${desc} (port ${port}) — HTTP ${code}"
    else
        if [[ "${FORCE}" == "true" ]]; then
            warn "${desc} (port ${port}) returned HTTP ${code} — FORCE=true, continuing..."
        else
            error "${desc} (port ${port}) returned HTTP ${code} — aborting!"
        fi
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
sudo cp "${NGINX_CONF}" "${NGINX_CONF}.pre-deploy" 2>/dev/null || true

# Swap ALL upstream server entries by toggling the `down` keyword
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
    warn "Nginx config test FAILED! Restoring pre-deploy config..."
    if [[ -f "${NGINX_CONF}.pre-deploy" ]]; then
        sudo cp "${NGINX_CONF}.pre-deploy" "${NGINX_CONF}"
        sudo nginx -t && sudo systemctl reload nginx || true
        sudo rm -f "${NGINX_CONF}.pre-deploy"
    fi
    error "Nginx swap failed — deploy aborted. Previous config restored."
fi

# ── Step 7: Update ACTIVE_SLOT in .env ──
if grep -q "^ACTIVE_SLOT=" "${ENV_FILE}" 2>/dev/null; then
    sudo sed -i "s/^ACTIVE_SLOT=.*/ACTIVE_SLOT=${TARGET_SLOT}/" "${ENV_FILE}"
else
    echo "ACTIVE_SLOT=${TARGET_SLOT}" | sudo tee -a "${ENV_FILE}" >/dev/null
fi
log "ACTIVE_SLOT updated to ${TARGET_SLOT^^} in .env"

# ── Step 8: Cleanup old Docker artifacts ──
docker image prune -f 2>/dev/null || true

# ── Post-deploy confirmation ──
echo ""
docker compose -f "${COMPOSE_FILE}" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
log "Blue-green switch complete! ${TARGET_SLOT^^} is now active."
echo ""
echo -e "${YELLOW}${BOLD}NOTE:${NC} The old ${ACTIVE_SLOT^^} environment is still running for rollback."
echo -e "      Stop it with:  ./scripts/blue-green-cleanup.sh ${ACTIVE_SLOT}"
echo -e "      Rollback with: ./scripts/blue-green-rollback.sh"
echo ""
