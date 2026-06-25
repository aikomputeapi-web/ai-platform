#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Deploy (pull pre-built images from GHCR)
# ══════════════════════════════════════════════════════════════════════════════
#
#  Called by GitHub Actions CI/CD after images are built & pushed.
#  Can also be run manually:  IMAGE_TAG=abc123 ./deploy.sh
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.unified.yml"
ENV_FILE="${SCRIPT_DIR}/.env"

IMAGE_TAG="${IMAGE_TAG:-latest}"
export IMAGE_TAG

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

# ── Ensure OmniRoute source is present (for env syncing, not build) ──
SETUP_OMNIROUTE="${SCRIPT_DIR}/scripts/setup-omniroute.sh"
if [[ -x "${SETUP_OMNIROUTE}" ]]; then
    if [[ ! -d "${SCRIPT_DIR}/OmniRoute/.git" ]]; then
        info "OmniRoute source missing — running setup-omniroute.sh"
        bash "${SETUP_OMNIROUTE}" || error "Failed to bootstrap OmniRoute source"
        log "OmniRoute source ready"
    fi
else
    warn "scripts/setup-omniroute.sh not found — assuming OmniRoute/ already present"
fi

# ── Sync OmniRoute .env secrets helper ──
sync_env_var() {
    local key="$1"
    local val="$2"
    local file="$3"
    local tmp_val
    tmp_val=$(mktemp)
    local tmp_out
    tmp_out=$(mktemp)

    printf '%s' "${val}" > "${tmp_val}"

    node -e '
        const fs = require("fs");
        const file = process.argv[1];
        const key  = process.argv[2];
        const val  = fs.readFileSync(process.argv[3], "utf8");
        const out  = process.argv[4];
        let content = "";
        try { content = fs.readFileSync(file, "utf8"); } catch {}
        const re = new RegExp("^" + key.replace(/[.*+?^${}()|[\]\\\\]/g, "\\$&") + "=.*", "m");
        const line = key + "=" + val;
        const nl = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
        const next = content.match(re) ? content.replace(re, line) : content + nl + line;
        fs.writeFileSync(out, next);
    ' "${file}" "${key}" "${tmp_val}" "${tmp_out}"

    mv "${tmp_out}" "${file}"
    rm -f "${tmp_val}"
}

# ── Sync OmniRoute .env secrets ──
if [[ -f "./OmniRoute/.env.example" ]] && [[ -f "./OmniRoute/.env" ]]; then
    if ! grep -q "^OMNIROUTE_PUBLIC_URL=" "${ENV_FILE}"; then
        DOMAIN=$(grep "^DOMAIN=" "${ENV_FILE}" | cut -d= -f2-)
        SSL_ENABLED=$(grep "^SSL_ENABLED=" "${ENV_FILE}" | cut -d= -f2- || echo "true")
        SCHEME="https"
        if [[ "${SSL_ENABLED}" == "false" ]]; then
            SCHEME="http"
        fi
        echo "OMNIROUTE_PUBLIC_URL=${SCHEME}://admin.${DOMAIN}" >> "${ENV_FILE}"
        log "Added OMNIROUTE_PUBLIC_URL to .env"
    fi

    JWT=$(grep "^OMNIROUTE_JWT_SECRET=" "${ENV_FILE}" | cut -d= -f2-)
    API_KEY=$(grep "^OMNIROUTE_API_KEY_SECRET=" "${ENV_FILE}" | cut -d= -f2-)
    STORAGE_KEY=$(grep "^OMNIROUTE_STORAGE_ENCRYPTION_KEY=" "${ENV_FILE}" | cut -d= -f2-)
    ADMIN_PASS=$(grep "^OMNIROUTE_INITIAL_PASSWORD=" "${ENV_FILE}" | cut -d= -f2-)
    OMNI_PUBLIC=$(grep "^OMNIROUTE_PUBLIC_URL=" "${ENV_FILE}" | cut -d= -f2-)

    sync_env_var "JWT_SECRET" "${JWT}" "./OmniRoute/.env"
    sync_env_var "API_KEY_SECRET" "${API_KEY}" "./OmniRoute/.env"
    sync_env_var "STORAGE_ENCRYPTION_KEY" "${STORAGE_KEY}" "./OmniRoute/.env"
    sync_env_var "INITIAL_PASSWORD" "${ADMIN_PASS}" "./OmniRoute/.env"
    sync_env_var "NEXT_PUBLIC_BASE_URL" "${OMNI_PUBLIC}" "./OmniRoute/.env"
    sync_env_var "BASE_URL" "${OMNI_PUBLIC}" "./OmniRoute/.env"

    log "OmniRoute .env synced"
fi

# ── Image Tagging for Rollbacks ──
info "Tagging current images as backup..."
docker tag ghcr.io/aikomputeapi-web/ai-platform/omniroute:latest omniroute:backup 2>/dev/null || true
docker tag ghcr.io/aikomputeapi-web/ai-platform/customer-portal:latest customer-portal:backup 2>/dev/null || true

# ── Pull pre-built images from GHCR ──
info "Pulling images from GHCR (tag: ${IMAGE_TAG})..."
IMAGE_TAG="${IMAGE_TAG}" docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" pull
log "Images pulled"

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
        fi

        if [[ -z "${status}" ]]; then
            local running=$(docker inspect --format '{{.State.Running}}' "${container_name}" 2>/dev/null)
            if [[ "${running}" != "true" ]]; then
                error "${container_name} failed to start"
            fi
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
    error "${container_name} did not become healthy within ${max_attempts} attempts"
}

# ── Helper: Database Migrations ──
run_migrations() {
    info "Running database migrations..."
    if docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" run --no-deps --rm customer-portal sh -c "node node_modules/prisma/build/index.js migrate deploy"; then
        log "Migrations applied"
        info "Running database seed..."
        docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" run --no-deps --rm customer-portal sh -c "node node_modules/prisma/build/index.js db seed" || warn "Seed failed (non-fatal)"
    else
        warn "Migration failed! Schema may be partially applied — manual inspection required."
        warn "Continuing deploy to avoid cascading outage; fix migrations manually."
    fi
}

# ── Run migrations ──
run_migrations

# ── Restart services ──
info "Restarting all services..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans
log "Services restarted"

# ── Wait for health ──
wait_for_health "cliproxyapi"
wait_for_health "omniroute"
wait_for_health "customer-portal"
wait_for_health "report-deliverer"

# ── Update nginx config from template ──
TARGET_NGINX="/etc/nginx/nginx.conf"
SOURCE_NGINX="${SCRIPT_DIR}/nginx/nginx.conf"
if [[ -f "${SOURCE_NGINX}" ]]; then
    DOMAIN=$(grep "^DOMAIN=" "${ENV_FILE}" | cut -d= -f2-)
    CERT_DOMAIN="${DOMAIN}"
    if [[ ! -d "/etc/letsencrypt/live/${CERT_DOMAIN}" ]]; then
        FOUND_CERT=$(find /etc/letsencrypt/live/ -mindepth 1 -maxdepth 1 -type d -not -name "README" 2>/dev/null | sort | head -n 1 || true)
        if [[ -n "${FOUND_CERT}" ]]; then
            CERT_DOMAIN=$(basename "${FOUND_CERT}")
        fi
    fi

    TEMP_CONF=$(mktemp)
    cp "${SOURCE_NGINX}" "${TEMP_CONF}"
    sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" "${TEMP_CONF}"
    sed -i "s/SSL_CERT_NAME_PLACEHOLDER/${CERT_DOMAIN}/g" "${TEMP_CONF}"

    if ! diff -q "${TEMP_CONF}" "${TARGET_NGINX}" &>/dev/null; then
        info "Nginx config changed — updating..."
        sudo cp "${TARGET_NGINX}" "${TARGET_NGINX}.bak" 2>/dev/null || true
        sudo cp "${TEMP_CONF}" "${TARGET_NGINX}"
        if sudo nginx -t; then
            sudo systemctl reload nginx
            log "Nginx reloaded"
            sudo rm -f "${TARGET_NGINX}.bak"
        else
            warn "Nginx config test failed! Restoring backup."
            sudo cp "${TARGET_NGINX}.bak" "${TARGET_NGINX}" 2>/dev/null || true
            sudo systemctl reload nginx || true
        fi
    else
        log "Nginx config unchanged"
    fi
    rm -f "${TEMP_CONF}"
else
    warn "nginx.conf template not found — skipping config update"
fi

# ── Cleanup ──
info "Cleaning up Docker artifacts..."
docker image prune -f 2>/dev/null || true

# ── Post-deploy confirmation ──
echo ""
docker compose -f "${COMPOSE_FILE}" ps --format "table {{.Name}}\t{{.Status}}"
echo ""

log "Deploy complete — all containers running and healthy!"
echo ""
