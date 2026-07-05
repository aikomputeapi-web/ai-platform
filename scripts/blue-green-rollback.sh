#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Blue-Green Rollback
# ══════════════════════════════════════════════════════════════════════════════
#
#  Reverses the last blue-green switch. Requires both environments to be
#  running (the old slot was left running by blue-green-switch.sh).
#
#  What this does:
#    1. Reads current ACTIVE_SLOT from .env
#    2. Swaps nginx upstream back to the previous slot
#    3. Updates ACTIVE_SLOT in .env
#
#  Usage:
#    ./scripts/blue-green-rollback.sh
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
NGINX_CONF="/etc/nginx/nginx.conf"

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo -e "${CYAN}${BOLD}═══ AI Platform — Blue-Green Rollback ═══${NC}"
echo ""

# ── Pre-flight checks ──
[[ -f "${ENV_FILE}" ]] || error ".env not found"
sudo nginx -v &>/dev/null || error "Nginx not found"

# ── Detect current active slot ──
ACTIVE_SLOT="$(grep "^ACTIVE_SLOT=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]')"
if [[ -z "${ACTIVE_SLOT}" ]]; then
    error "ACTIVE_SLOT not found in .env — cannot determine rollback target"
fi

ACTIVE_SLOT="${ACTIVE_SLOT,,}"

if [[ "${ACTIVE_SLOT}" == "blue" ]]; then
    ROLLBACK_SLOT="green"
    ACTIVE_OMNI="omniroute"
    ACTIVE_PORTAL="customer-portal"
    ROLLBACK_OMNI="omniroute-green"
    ROLLBACK_PORTAL="customer-portal-green"
else
    ROLLBACK_SLOT="blue"
    ACTIVE_OMNI="omniroute-green"
    ACTIVE_PORTAL="customer-portal-green"
    ROLLBACK_OMNI="omniroute"
    ROLLBACK_PORTAL="customer-portal"
fi

info "Current active: ${ACTIVE_SLOT^^}"
info "Rolling back to: ${ROLLBACK_SLOT^^}"

# ── Verify rollback target containers are running ──
info "Checking ${ROLLBACK_SLOT^^} containers..."
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${ROLLBACK_OMNI}$"; then
    log "${ROLLBACK_OMNI} is running"
else
    warn "${ROLLBACK_OMNI} is NOT running — nginx swap will still proceed, but traffic may 502"
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${ROLLBACK_PORTAL}$"; then
    log "${ROLLBACK_PORTAL} is running"
else
    warn "${ROLLBACK_PORTAL} is NOT running — nginx swap will still proceed, but traffic may 502"
fi

# ── Backup current nginx config ──
sudo cp "${NGINX_CONF}" "${NGINX_CONF}.pre-rollback" 2>/dev/null || true

# ── Swap nginx upstream back to rollback slot ──
info "Swapping nginx upstream to ${ROLLBACK_SLOT^^}..."

if [[ "${ROLLBACK_SLOT}" == "green" ]]; then
    # Blue → down, Green → up (Green becomes active)
    sudo sed -i 's/server 127.0.0.1:20128;/server 127.0.0.1:20128 down;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:20138 down;/server 127.0.0.1:20138;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:20129;/server 127.0.0.1:20129 down;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:20139 down;/server 127.0.0.1:20139;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:3000;/server 127.0.0.1:3000 down;/' "${NGINX_CONF}"
    sudo sed -i 's/server 127.0.0.1:3001 down;/server 127.0.0.1:3001;/' "${NGINX_CONF}"
else
    # Green → down, Blue → up (Blue becomes active)
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
    log "Nginx reloaded — traffic now routed to ${ROLLBACK_SLOT^^}"
    sudo rm -f "${NGINX_CONF}.pre-rollback"
else
    warn "Nginx config test FAILED! Restoring pre-rollback config..."
    if [[ -f "${NGINX_CONF}.pre-rollback" ]]; then
        sudo cp "${NGINX_CONF}.pre-rollback" "${NGINX_CONF}"
        sudo nginx -t && sudo systemctl reload nginx || true
        sudo rm -f "${NGINX_CONF}.pre-rollback"
    fi
    error "Nginx swap failed — rollback aborted. Previous config restored."
fi

# ── Update ACTIVE_SLOT in .env ──
if grep -q "^ACTIVE_SLOT=" "${ENV_FILE}" 2>/dev/null; then
    sudo sed -i "s/^ACTIVE_SLOT=.*/ACTIVE_SLOT=${ROLLBACK_SLOT}/" "${ENV_FILE}"
else
    echo "ACTIVE_SLOT=${ROLLBACK_SLOT}" | sudo tee -a "${ENV_FILE}" >/dev/null
fi
log "ACTIVE_SLOT updated to ${ROLLBACK_SLOT^^} in .env"

echo ""
log "Rollback complete! ${ROLLBACK_SLOT^^} is now active."
echo ""
echo -e "${YELLOW}${BOLD}NOTE:${NC} The ${ACTIVE_SLOT^^} environment is still running."
echo -e "      Stop it with:  ./scripts/blue-green-cleanup.sh ${ACTIVE_SLOT}"
echo ""
