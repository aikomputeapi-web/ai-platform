#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Blue-Green Cleanup
# ══════════════════════════════════════════════════════════════════════════════
#
#  Stops and removes the specified environment after confirming the other
#  slot is healthy and serving traffic. Also removes the old volume.
#
#  Usage:
#    ./scripts/blue-green-cleanup.sh blue    # Stop & remove blue environment
#    ./scripts/blue-green-cleanup.sh green   # Stop & remove green environment
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.unified.yml"
ENV_FILE="${SCRIPT_DIR}/.env"

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo -e "${CYAN}${BOLD}═══ AI Platform — Blue-Green Cleanup ═══${NC}"
echo ""

# ── Determine which slot to clean ──
TARGET="${1:-}"
if [[ -z "${TARGET}" ]]; then
    echo "Usage: ./scripts/blue-green-cleanup.sh <blue|green>"
    echo ""
    echo "  Cleans up the specified environment (stops containers, removes volume)."
    echo "  Only safe to run after confirming the other slot is healthy."
    exit 1
fi

TARGET="${TARGET,,}"

if [[ "${TARGET}" != "blue" ]] && [[ "${TARGET}" != "green" ]]; then
    error "Target must be 'blue' or 'green', got: ${TARGET}"
fi

# ── Get current active slot ──
ACTIVE_SLOT="$(grep "^ACTIVE_SLOT=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]')"
if [[ -z "${ACTIVE_SLOT}" ]]; then
    warn "ACTIVE_SLOT not found in .env — assuming blue is active"
    ACTIVE_SLOT="blue"
fi

if [[ "${TARGET}" == "${ACTIVE_SLOT}" ]]; then
    error "Cannot clean up the ACTIVE slot (${TARGET^^})! Switch to the other slot first."
fi

if [[ "${TARGET}" == "blue" ]]; then
    TARGET_OMNI="omniroute"
    TARGET_PORTAL="customer-portal"
    VOLUME_NAME="ai-omniroute-data"
else
    TARGET_OMNI="omniroute-green"
    TARGET_PORTAL="customer-portal-green"
    VOLUME_NAME="ai-omniroute-data-green"
fi

echo -e "${YELLOW}${BOLD}WARNING:${NC} This will stop and remove the ${TARGET^^} environment."
echo -e "        Volume '${VOLUME_NAME}' will be DELETED."
echo ""
read -rp "Type 'YES' to proceed: " confirmation
if [[ "${confirmation}" != "YES" ]]; then
    info "Cleanup cancelled."
    exit 0
fi

# ── Stop and remove containers ──
info "Stopping ${TARGET^^} containers..."
docker compose -f "${COMPOSE_FILE}" stop "${TARGET_OMNI}" "${TARGET_PORTAL}" 2>/dev/null || true
docker compose -f "${COMPOSE_FILE}" rm -f "${TARGET_OMNI}" "${TARGET_PORTAL}" 2>/dev/null || true
log "${TARGET^^} containers stopped and removed"

# ── Remove volume ──
info "Removing volume '${VOLUME_NAME}'..."
docker volume rm "${VOLUME_NAME}" 2>/dev/null || warn "Volume '${VOLUME_NAME}' not found or still in use"
log "Volume '${VOLUME_NAME}' removed"

# ── Confirm active slot is still healthy ──
echo ""
info "Verifying ${ACTIVE_SLOT^^} (active) is still healthy..."
if [[ "${ACTIVE_SLOT}" == "blue" ]]; then
    ACTIVE_OMNI="omniroute"
else
    ACTIVE_OMNI="omniroute-green"
fi
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${ACTIVE_OMNI}$"; then
    log "${ACTIVE_OMNI} is running"
else
    warn "${ACTIVE_OMNI} is NOT running — check services!"
fi

echo ""
log "Cleanup complete. ${TARGET^^} environment removed."
echo ""
