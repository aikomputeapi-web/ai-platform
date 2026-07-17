#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Blue-Green Zero-Downtime Switch
# ══════════════════════════════════════════════════════════════════════════════
#
#  Orchestrates a blue-green deployment (ZERO DATA LOSS — see Step 6):
#    1. Detect active slot (BLUE or GREEN) from .env or nginx config
#    2. Verify portal→OmniRoute slot wiring in the compose config
#    3. Pull latest images from GHCR
#    4. Run database migrations (idempotent, backward-compatible)
#    5. WARM-copy SQLite data from active volume to target volume (live copy,
#       possibly missing the newest writes — used only to pre-validate target)
#    6. Start target containers, wait for health, verify endpoints
#    7. FINAL HANDOFF: stop BOTH OmniRoutes, re-copy the SQLite files
#       (authoritative, no writer running → nothing can be lost), restart
#       target. Brief /v1 outage (~15-30s); any failure restarts active.
#    8. Swap nginx upstream (sed + nginx -t + systemctl reload nginx)
#    9. Update ACTIVE_SLOT in .env + deploy-state/active-slot (workers read it)
#   10. Old portal stays up for rollback; old OmniRoute stays STOPPED so its
#       now-stale database can never take another write. Roll back with
#       ./scripts/blue-green-rollback.sh (does the same handoff in reverse).
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

# ── Verify portal→OmniRoute slot wiring ──
# Guards against reintroducing the 2026-07-17 split-brain: customer-portal-green
# inheriting blue's OMNIROUTE_INTERNAL_URL meant keys created while GREEN was
# live landed in BLUE's SQLite — invisible to the live slot and destroyed by the
# next deploy's volume copy. Each portal MUST target its own slot's OmniRoute.
# This check runs before anything is pulled, copied, or stopped.
info "Verifying portal→OmniRoute slot wiring..."
WIRING_ERR="$(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" --profile green config --format json 2>/dev/null | python3 -c "
import json, sys
services = json.load(sys.stdin)['services']
expected = {
    'customer-portal': 'http://omniroute:20128',
    'customer-portal-green': 'http://omniroute-green:20128',
}
errs = []
for svc, want in expected.items():
    got = services.get(svc, {}).get('environment', {}).get('OMNIROUTE_INTERNAL_URL')
    if got != want:
        errs.append(f'{svc} has OMNIROUTE_INTERNAL_URL={got!r}, expected {want!r}')
print('; '.join(errs))
")" || error "Could not render compose config for the slot-wiring check"
if [[ -n "${WIRING_ERR}" ]]; then
    error "Slot wiring broken — ${WIRING_ERR}. Fix docker-compose.unified.yml before deploying (see the customer-portal-green environment override)."
fi
log "Slot wiring verified — each portal targets its own slot's OmniRoute"

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

# ── Step 2: WARM copy of data from ACTIVE to TARGET volume ──
# This copy runs while ACTIVE is still serving writes, so it can be missing the
# newest writes (and a live WAL-mode SQLite copied this way is not even
# guaranteed consistent). It exists ONLY to (a) move the bulk data (logs,
# caches) outside the outage window and (b) let the target boot and prove the
# new image works before we touch the live slot. The AUTHORITATIVE copy happens
# in the final handoff below, with both OmniRoutes stopped.
info "Warm-copying data from ${ACTIVE_SLOT^^} to ${TARGET_SLOT^^}..."

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
log "Warm copy done (${VOLUME_SRC} → ${VOLUME_DST})"

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

# ── Step 5.5: FINAL SQLite handoff — the zero-loss step ──
# Everything up to here ran against a WARM copy that may be missing writes made
# during the deploy (an API key issued mid-deploy is exactly what got destroyed
# on 2026-07-17). Now do the authoritative copy with NO writer running:
#
#   1. Pause the api-key-reconciler (it must not reconcile against a
#      transitional state while the two stores are being swapped).
#   2. Stop ACTIVE OmniRoute  → writes stop; /v1 502s until the flip (~15-30s).
#   3. Stop TARGET OmniRoute  → it was only validating the warm copy.
#   4. Re-copy the SQLite files (db + WAL + SHM, forced) and update-copy the
#      rest of the data dir. Both writers are stopped, so this copy is
#      complete and consistent — nothing written before this point can be lost.
#   5. Restart TARGET on the authoritative data and wait for health.
#
# Any failure from here until the nginx smoke check passes restarts ACTIVE
# OmniRoute (its volume is untouched) via the EXIT trap below, so an aborted
# deploy always leaves the site serving from the slot it started on.
info "Pausing api-key-reconciler for the handoff..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" stop api-key-reconciler 2>/dev/null || true

HANDOFF_COMPLETE=false
restore_active_on_failure() {
    if [[ "${HANDOFF_COMPLETE}" != "true" ]]; then
        warn "Deploy failed mid-handoff — restarting ${ACTIVE_SLOT^^} OmniRoute (its data is intact)..."
        docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d "${ACTIVE_OMNI}" || \
            warn "Could not restart ${ACTIVE_OMNI} — MANUAL INTERVENTION NEEDED"
        docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --no-deps api-key-reconciler || true
    fi
}
trap restore_active_on_failure EXIT

info "Stopping ${ACTIVE_SLOT^^} OmniRoute for the final handoff (brief /v1 outage begins)..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" stop "${ACTIVE_OMNI}"
info "Stopping ${TARGET_SLOT^^} OmniRoute to receive the authoritative data..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" stop "${TARGET_OMNI}"

info "Authoritative SQLite copy (${VOLUME_SRC} → ${VOLUME_DST})..."
# Force-copy the SQLite trio (removing stale WAL/SHM in dst when src has none —
# a leftover WAL from the warm copy would corrupt the db), then update-copy any
# other files that changed since the warm copy (call logs etc.).
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
    ' || error "Authoritative SQLite copy failed"
log "Authoritative copy done — no writer was running, nothing can be lost"

info "Restarting ${TARGET_SLOT^^} OmniRoute on the authoritative data..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d "${TARGET_OMNI}"
wait_for_health "${TARGET_OMNI}" 45

# ── Step 6: Swap nginx upstream to TARGET ──
info "Swapping nginx upstream to ${TARGET_SLOT^^}..."

# Backup current nginx config
sudo cp "${NGINX_CONF}" "${NGINX_CONF}.pre-deploy" 2>/dev/null || true

# Swap ALL upstream server entries by toggling the `down` keyword.
# The nginx config format is:
#   server 127.0.0.1:PORT max_fails=3 fail_timeout=10s;                 # active
#   server 127.0.0.1:PORT max_fails=3 fail_timeout=10s down;            # standby
#
# `set_upstream_state` is IDEMPOTENT: it first strips every `down` token for the
# port (including a doubled `down down` left by an interrupted/retried earlier
# deploy) and then re-adds exactly one only when the slot must be standby.
#
# The previous implementation used two non-idempotent seds per port:
#   add:    s/\(server ...PORT[^;]*\);/\1 down;/     ← greedy [^;]* re-appended
#           ` down` even when already present  → produced `down down`
#   remove: s/\(server ...PORT[^;]*\) down;/\1;/     ← stripped only ONE `down`
# Across the 3 cancelled + 1 real retry of a single deploy that left EVERY
# upstream marked `down` (active slot included) → nginx "no live upstreams" →
# the whole site 502'd (2026-07-13). Strip-then-set makes the toggle safe to run
# any number of times from any prior state.
set_upstream_state() {
    local port="$1" state="$2"   # state: up | down
    # Anchor on the fixed `max_fails=N fail_timeout=Ns` prefix (deterministic —
    # unlike the old greedy [^;]* which mis-captured the trailing ` down`).
    local prefix="server 127\\.0\\.0\\.1:${port} max_fails=[0-9]\\+ fail_timeout=[0-9]\\+s"
    # 1) strip zero-or-more ` down` tokens
    sudo sed -i "s/\\(${prefix}\\)\\( down\\)*;/\\1;/" "${NGINX_CONF}"
    # 2) add exactly one when standby
    if [[ "${state}" == "down" ]]; then
        sudo sed -i "s/\\(${prefix}\\);/\\1 down;/" "${NGINX_CONF}"
    fi
}

# Ports per slot: <web> <api> <portal>. TARGET goes up, the old ACTIVE goes down.
if [[ "${TARGET_SLOT}" == "green" ]]; then
    TARGET_PORTS_ARR=(20138 20139 3001); STANDBY_PORTS_ARR=(20128 20129 3000)
else
    TARGET_PORTS_ARR=(20128 20129 3000); STANDBY_PORTS_ARR=(20138 20139 3001)
fi
for _p in "${TARGET_PORTS_ARR[@]}";  do set_upstream_state "${_p}" up;   done
for _p in "${STANDBY_PORTS_ARR[@]}"; do set_upstream_state "${_p}" down; done

# Guard: at least one server per upstream must be live (no stray `down`).
if sudo grep -Eq "server 127\\.0\\.0\\.1:(${TARGET_PORTS_ARR[0]}|${TARGET_PORTS_ARR[1]}|${TARGET_PORTS_ARR[2]})[^;]* down;" "${NGINX_CONF}"; then
    warn "Target slot still has a 'down' marker after toggle — restoring pre-deploy config"
    [[ -f "${NGINX_CONF}.pre-deploy" ]] && sudo cp "${NGINX_CONF}.pre-deploy" "${NGINX_CONF}"
    sudo nginx -t && sudo systemctl reload nginx || true
    sudo rm -f "${NGINX_CONF}.pre-deploy"
    error "Upstream toggle produced an all-down target — deploy aborted, previous config restored."
fi

# ── Test config, reload, then SMOKE-CHECK through nginx ──
# `nginx -t` only proves syntax — it does NOT prove traffic is served (an
# all-`down` upstream still passes `nginx -t` but returns 502). So after reload
# we hit the public front door THROUGH nginx and auto-revert if it does not serve.
SMOKE_HOST="${SMOKE_HOST:-aikompute.com}"
smoke_check() {
    local code
    code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 8 \
        -H "Host: ${SMOKE_HOST}" "https://127.0.0.1/" 2>/dev/null || echo 000)
    info "Smoke check (Host: ${SMOKE_HOST}) → HTTP ${code}"
    # Non-5xx (200/301/302/307/401/403…) = nginx reached a live backend.
    # 000 / 5xx = the swap did not actually route traffic.
    [[ "${code}" =~ ^[234][0-9][0-9]$ ]]
}

revert_nginx() {
    if [[ -f "${NGINX_CONF}.pre-deploy" ]]; then
        sudo cp "${NGINX_CONF}.pre-deploy" "${NGINX_CONF}"
        sudo nginx -t && sudo systemctl reload nginx || true
        sudo rm -f "${NGINX_CONF}.pre-deploy"
    fi
}

if ! sudo nginx -t; then
    warn "Nginx config test FAILED! Restoring pre-deploy config..."
    revert_nginx
    error "Nginx swap failed (config test) — deploy aborted. Previous config restored."
fi

sudo systemctl reload nginx
sleep 1
if smoke_check; then
    HANDOFF_COMPLETE=true
    log "Nginx reloaded and smoke check passed — traffic now routed to ${TARGET_SLOT^^}"
    sudo rm -f "${NGINX_CONF}.pre-deploy"
else
    warn "Smoke check FAILED after swap — site not serving. Reverting to pre-deploy config..."
    revert_nginx
    if smoke_check; then
        warn "Reverted to previous slot — it is serving again."
    else
        warn "Revert did not restore serving — MANUAL INTERVENTION NEEDED."
    fi
    error "Blue-green swap did not serve traffic — deploy aborted, reverted to previous slot."
fi

# ── Step 7: Update ACTIVE_SLOT in .env ──
if grep -q "^ACTIVE_SLOT=" "${ENV_FILE}" 2>/dev/null; then
    sudo sed -i "s/^ACTIVE_SLOT=.*/ACTIVE_SLOT=${TARGET_SLOT}/" "${ENV_FILE}"
else
    echo "ACTIVE_SLOT=${TARGET_SLOT}" | sudo tee -a "${ENV_FILE}" >/dev/null
fi
log "ACTIVE_SLOT updated to ${TARGET_SLOT^^} in .env"

# Publish the live slot for the always-on workers (api-key-reconciler,
# report-deliverer). They re-read this file every cycle so they always talk to
# the LIVE portal — reconciling via the standby portal compares Postgres
# against the standby's stale SQLite and revokes/deletes live keys.
mkdir -p "${SCRIPT_DIR}/deploy-state"
echo "${TARGET_SLOT}" > "${SCRIPT_DIR}/deploy-state/active-slot"
log "deploy-state/active-slot → ${TARGET_SLOT}"

# Resume the reconciler now that both stores are consistent again.
# --no-deps is REQUIRED: the reconciler's dependency chain reaches the BLUE
# portal and BLUE OmniRoute, and without it compose restarts the stale slot's
# OmniRoute we just deliberately stopped.
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --no-deps api-key-reconciler 2>/dev/null || \
    warn "Could not restart api-key-reconciler — start it manually"

# ── Post-deploy drift check (read-only) ──
# Dry-run reconcile through the NEW live portal: proves the portal↔OmniRoute
# pairing is sane and that no key mappings died in the handoff. Non-fatal —
# traffic is already flipped — but a non-zero count here means investigate NOW.
ADMIN_SECRET="$(grep '^ADMIN_API_SECRET=' "${ENV_FILE}" | cut -d= -f2- | tr -d '[:space:]')"
if [[ -n "${ADMIN_SECRET}" ]]; then
    PORTAL_PORT=$([[ "${TARGET_SLOT}" == "green" ]] && echo 3001 || echo 3000)
    DRIFT="$(curl -s --max-time 20 -H "Authorization: Bearer ${ADMIN_SECRET}" \
        "http://127.0.0.1:${PORTAL_PORT}/api/admin/keys/reconcile" | python3 -c "
import json, sys
try:
    r = json.load(sys.stdin)
except Exception:
    print('unreadable'); raise SystemExit
if not r.get('omniRouteReachable', False):
    print('portal cannot reach its OmniRoute')
else:
    dead = r.get('deadPortalMappings', 0)
    orphans = r.get('orphanedOmniRouteKeys', 0)
    if dead or orphans:
        print(f'{dead} dead mapping(s), {orphans} orphaned key(s)')
    else:
        print('')
" 2>/dev/null || echo 'unreadable')"
    if [[ -z "${DRIFT}" ]]; then
        log "Post-deploy drift check: portal and OmniRoute key stores are in sync"
    else
        warn "Post-deploy drift check: ${DRIFT} — inspect GET /api/admin/keys/reconcile"
    fi
else
    warn "ADMIN_API_SECRET not found in .env — skipping post-deploy drift check"
fi

# ── Step 8: Cleanup old Docker artifacts ──
docker image prune -f 2>/dev/null || true

# ── Post-deploy confirmation ──
echo ""
docker compose -f "${COMPOSE_FILE}" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
log "Blue-green switch complete! ${TARGET_SLOT^^} is now active."
echo ""
echo -e "${YELLOW}${BOLD}NOTE:${NC} The old ${ACTIVE_SLOT^^} portal is still running; its OmniRoute is"
echo -e "      intentionally STOPPED — its database is now stale and must never take"
echo -e "      another write. Do NOT start it by hand."
echo -e "      Stop the rest with: ./scripts/blue-green-cleanup.sh ${ACTIVE_SLOT}"
echo -e "      Rollback with:      ./scripts/blue-green-rollback.sh (zero-loss reverse handoff)"
echo ""
