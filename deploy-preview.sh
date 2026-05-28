#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Deploy Preview / Staging
# ══════════════════════════════════════════════════════════════════════════════
#
#  Called by GitHub Actions CI/CD on pushes to the staging branch.
#  Can also be run manually:  ./deploy-preview.sh
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.unified.yml"
PREVIEW_FILE="${SCRIPT_DIR}/docker-compose.preview.yml"
ENV_FILE="${SCRIPT_DIR}/.env"

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo -e "${CYAN}${BOLD}═══ AI Platform — Preview Deploy ═══${NC}"
echo ""

[[ -f "${ENV_FILE}" ]] || error ".env not found. Run setup.sh first."
[[ -f "${COMPOSE_FILE}" ]] || error "docker-compose.unified.yml not found."
[[ -f "${PREVIEW_FILE}" ]] || error "docker-compose.preview.yml not found."
docker compose version &>/dev/null || error "Docker Compose not found."

log "Environment OK"

cd "${SCRIPT_DIR}"

info "Pulling preview stack changes if available"
git fetch origin staging 2>/dev/null || true

info "Building preview stack"
set +e
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -f "${PREVIEW_FILE}" -p aikompute-preview build --parallel 2>&1
BUILD_RC=$?
set -e

if [[ $BUILD_RC -ne 0 ]]; then
    error "Build failed (exit ${BUILD_RC}). Check output above."
fi
log "Build complete"

info "Starting preview stack"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -f "${PREVIEW_FILE}" -p aikompute-preview up -d --remove-orphans

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
            error "${container_name} reported unhealthy state."
        fi
        
        # Fallback
        if [[ -z "${status}" ]]; then
            local running=$(docker inspect --format '{{.State.Running}}' "${container_name}" 2>/dev/null)
            if [[ "${running}" != "true" ]]; then
                error "${container_name} is not running."
            fi
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
    error "Timeout waiting for ${container_name} to become healthy."
}

# Wait for core databases first
wait_for_health "aikompute-preview-postgres"
wait_for_health "aikompute-preview-redis"

# Wait for sidecar and apps
wait_for_health "aikompute-preview-cliproxyapi"
wait_for_health "aikompute-preview-omniroute-1"
wait_for_health "aikompute-preview-customer-portal-1"

echo ""
docker compose -f "${COMPOSE_FILE}" -f "${PREVIEW_FILE}" -p aikompute-preview ps --format "table {{.Name}}\t{{.Status}}"
echo ""

log "Preview deploy complete — all containers running and healthy!"
echo ""
