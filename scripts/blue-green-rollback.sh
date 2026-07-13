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

# Idempotent upstream toggle — strips any/all `down` tokens (recovering from a
# doubled `down down` left by an interrupted deploy) then re-adds exactly one to
# the standby slot. Mirrors scripts/blue-green-switch.sh::set_upstream_state; see
# that file for the full rationale (the old greedy [^;]* toggle left every
# upstream `down` and 502'd the site on 2026-07-13).
set_upstream_state() {
    local port="$1" state="$2"   # state: up | down
    local prefix="server 127\\.0\\.0\\.1:${port} max_fails=[0-9]\\+ fail_timeout=[0-9]\\+s"
    sudo sed -i "s/\\(${prefix}\\)\\( down\\)*;/\\1;/" "${NGINX_CONF}"
    if [[ "${state}" == "down" ]]; then
        sudo sed -i "s/\\(${prefix}\\);/\\1 down;/" "${NGINX_CONF}"
    fi
}

# Rollback target goes up; the other slot goes down.
if [[ "${ROLLBACK_SLOT}" == "green" ]]; then
    UP_PORTS_ARR=(20138 20139 3001); DOWN_PORTS_ARR=(20128 20129 3000)
else
    UP_PORTS_ARR=(20128 20129 3000); DOWN_PORTS_ARR=(20138 20139 3001)
fi
for _p in "${UP_PORTS_ARR[@]}";   do set_upstream_state "${_p}" up;   done
for _p in "${DOWN_PORTS_ARR[@]}"; do set_upstream_state "${_p}" down; done

# ── Test config, reload, then SMOKE-CHECK through nginx ──
SMOKE_HOST="${SMOKE_HOST:-aikompute.com}"
smoke_check() {
    local code
    code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 8 \
        -H "Host: ${SMOKE_HOST}" "https://127.0.0.1/" 2>/dev/null || echo 000)
    info "Smoke check (Host: ${SMOKE_HOST}) → HTTP ${code}"
    [[ "${code}" =~ ^[234][0-9][0-9]$ ]]
}
revert_nginx() {
    if [[ -f "${NGINX_CONF}.pre-rollback" ]]; then
        sudo cp "${NGINX_CONF}.pre-rollback" "${NGINX_CONF}"
        sudo nginx -t && sudo systemctl reload nginx || true
        sudo rm -f "${NGINX_CONF}.pre-rollback"
    fi
}

if ! sudo nginx -t; then
    warn "Nginx config test FAILED! Restoring pre-rollback config..."
    revert_nginx
    error "Nginx swap failed (config test) — rollback aborted. Previous config restored."
fi

sudo systemctl reload nginx
sleep 1
if smoke_check; then
    log "Nginx reloaded and smoke check passed — traffic now routed to ${ROLLBACK_SLOT^^}"
    sudo rm -f "${NGINX_CONF}.pre-rollback"
else
    warn "Smoke check FAILED after rollback swap — site not serving. Reverting..."
    revert_nginx
    error "Rollback swap did not serve traffic — aborted, previous config restored."
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
