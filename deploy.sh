#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Deploy (Blue-Green Zero-Downtime)
# ══════════════════════════════════════════════════════════════════════════════
#
#  Called by GitHub Actions CI/CD after images are built & pushed.
#  Can also be run manually:
#    ./deploy.sh                          # Deploy with default options
#    IMAGE_TAG=abc123 ./deploy.sh         # Deploy specific image tag
#    ACTIVE_SLOT=blue ./deploy.sh         # Override slot detection
#    FORCE=true ./deploy.sh               # Skip health checks (emergency)
#
#  This script delegates to scripts/blue-green-switch.sh for the actual
#  blue-green orchestration. It exists as a thin wrapper so existing CI/CD
#  pipelines that call ./deploy.sh continue to work unchanged.
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
echo -e "${CYAN}${BOLD}═══ AI Platform — Deploy (Blue-Green) ═══${NC}"
echo ""

# ── Pre-flight checks ──
[[ -f "${ENV_FILE}" ]] || error ".env not found. Run setup.sh first."
[[ -f "${COMPOSE_FILE}" ]] || error "docker-compose.unified.yml not found."
docker compose version &>/dev/null || error "Docker Compose not found."
sudo nginx -v &>/dev/null || error "Nginx not found."

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

# ── Tag backup images (for emergency recovery) ──
info "Tagging current images as backup..."
docker tag ghcr.io/aikomputeapi-web/ai-platform/omniroute:latest omniroute:backup 2>/dev/null || true
docker tag ghcr.io/aikomputeapi-web/ai-platform/customer-portal:latest customer-portal:backup 2>/dev/null || true

# ── Delegate to blue-green switch script ──
# All the heavy lifting (pull, migrate, copy volume, start green, health check,
# swap nginx, update .env) is handled by the switch script.
info "Delegating to blue-green switch script..."
cd "${SCRIPT_DIR}"

if [[ -x "${SCRIPT_DIR}/scripts/blue-green-switch.sh" ]]; then
    bash "${SCRIPT_DIR}/scripts/blue-green-switch.sh"
    log "Blue-green deploy complete!"
else
    error "scripts/blue-green-switch.sh not found or not executable"
fi

# ── Post-deploy confirmation ──
echo ""
docker compose -f "${COMPOSE_FILE}" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""

log "Deploy complete — ${TARGET_SLOT:-new} environment is now serving traffic!"
echo -e "${YELLOW}${BOLD}NOTE:${NC} Previous environment is still running for rollback."
echo -e "      Run './scripts/blue-green-rollback.sh' to revert if needed."
echo -e "      Run './scripts/blue-green-cleanup.sh <slot>' to clean up old environment."
echo ""
