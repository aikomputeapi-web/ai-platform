#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Blue-Green Rollback
# ══════════════════════════════════════════════════════════════════════════════
#
#  Reverses the last blue-green switch. Requires both environments to be
#  running (the old slot was left running by blue-green-switch.sh).
#
#  What this does (ZERO DATA LOSS — mirrors blue-green-switch.sh's handoff):
#    1. Reads current ACTIVE_SLOT from .env
#    2. Pauses the api-key-reconciler
#    3. Stops BOTH OmniRoutes and copies the SQLite files from the current
#       active volume to the rollback volume — the active slot has been taking
#       writes since the switch, so flipping nginx back WITHOUT this copy
#       would silently abandon every key/write made since the deploy
#    4. Starts the rollback OmniRoute on that data and waits for health
#    5. Swaps nginx upstream back to the previous slot
#    6. Updates ACTIVE_SLOT in .env + deploy-state/active-slot, resumes the
#       reconciler
#
#  The rollback slot runs the OLD CODE on the CURRENT DATA. If the deploy
#  corrupted the data itself, restore from db_backups/ instead — set
#  ROLLBACK_SKIP_DATA=true to flip without copying (accepts data loss).
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

COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.unified.yml"
ROLLBACK_SKIP_DATA="${ROLLBACK_SKIP_DATA:-false}"

if [[ "${ACTIVE_SLOT}" == "blue" ]]; then
    VOLUME_SRC="ai-omniroute-data"          # current active — source of truth
    VOLUME_DST="ai-omniroute-data-green"    # rollback slot
else
    VOLUME_SRC="ai-omniroute-data-green"
    VOLUME_DST="ai-omniroute-data"
fi

# ── Ensure the rollback PORTAL is running (stateless, safe to start early) ──
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --no-deps "${ROLLBACK_PORTAL}" 2>/dev/null || \
    warn "Could not start ${ROLLBACK_PORTAL} — portal traffic may 502 after the flip"

# ── Zero-loss reverse handoff ──
# The active slot's SQLite is the source of truth (it has every write since the
# switch). Copy it to the rollback volume with both writers stopped, exactly
# like the forward deploy's final handoff. Failure restarts the active
# OmniRoute via the EXIT trap, leaving the site as it was.
if [[ "${ROLLBACK_SKIP_DATA}" == "true" ]]; then
    warn "ROLLBACK_SKIP_DATA=true — flipping WITHOUT copying data. Writes made since the last switch will NOT exist on ${ROLLBACK_SLOT^^}."
else
    info "Pausing api-key-reconciler for the handoff..."
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" stop api-key-reconciler 2>/dev/null || true

    HANDOFF_COMPLETE=false
    restore_active_on_failure() {
        if [[ "${HANDOFF_COMPLETE}" != "true" ]]; then
            warn "Rollback failed mid-handoff — restarting ${ACTIVE_SLOT^^} OmniRoute (its data is intact)..."
            docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d "${ACTIVE_OMNI}" || \
                warn "Could not restart ${ACTIVE_OMNI} — MANUAL INTERVENTION NEEDED"
            docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --no-deps api-key-reconciler || true
        fi
    }
    trap restore_active_on_failure EXIT

    info "Stopping ${ACTIVE_SLOT^^} OmniRoute for the handoff (brief /v1 outage begins)..."
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" stop "${ACTIVE_OMNI}" 2>/dev/null || true
    info "Stopping ${ROLLBACK_SLOT^^} OmniRoute (if running)..."
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" stop "${ROLLBACK_OMNI}" 2>/dev/null || true

    info "Copying SQLite data (${VOLUME_SRC} → ${VOLUME_DST})..."
    docker run --rm \
        -v "${VOLUME_SRC}:/src:ro" \
        -v "${VOLUME_DST}:/dst" \
        alpine sh -c '
            set -e
            rm -f /dst/storage.sqlite /dst/storage.sqlite-wal /dst/storage.sqlite-shm
            cp -a /src/storage.sqlite /dst/
            for f in storage.sqlite-wal storage.sqlite-shm; do
                [ -f "/src/$f" ] && cp -a "/src/$f" /dst/
            done
            cp -au /src/. /dst/ 2>/dev/null || true
        ' || error "SQLite copy failed — active slot will be restarted"
    log "Data handed off to ${ROLLBACK_SLOT^^}"

    info "Starting ${ROLLBACK_SLOT^^} OmniRoute..."
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d "${ROLLBACK_OMNI}"
    attempt=1
    while [[ $attempt -le 45 ]]; do
        status="$(docker inspect --format '{{json .State.Health.Status}}' "${ROLLBACK_OMNI}" 2>/dev/null | tr -d '"' || echo '')"
        [[ "${status}" == "healthy" ]] && break
        [[ "${status}" == "unhealthy" ]] && error "${ROLLBACK_OMNI} is UNHEALTHY — aborting rollback"
        sleep 2
        attempt=$((attempt + 1))
    done
    [[ "${status}" == "healthy" ]] || error "${ROLLBACK_OMNI} not healthy in time — aborting rollback"
    log "${ROLLBACK_OMNI} is healthy on the handed-off data"
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
    HANDOFF_COMPLETE=true
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

# Publish the live slot for the always-on workers (see blue-green-switch.sh).
mkdir -p "${SCRIPT_DIR}/deploy-state"
echo "${ROLLBACK_SLOT}" > "${SCRIPT_DIR}/deploy-state/active-slot"
log "deploy-state/active-slot → ${ROLLBACK_SLOT}"

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --no-deps api-key-reconciler 2>/dev/null || \
    warn "Could not restart api-key-reconciler — start it manually"

echo ""
log "Rollback complete! ${ROLLBACK_SLOT^^} is now active."
echo ""
echo -e "${YELLOW}${BOLD}NOTE:${NC} The ${ACTIVE_SLOT^^} portal is still running; its OmniRoute is"
echo -e "      intentionally STOPPED (stale data — must never take another write)."
echo -e "      Stop the rest with: ./scripts/blue-green-cleanup.sh ${ACTIVE_SLOT}"
echo ""
