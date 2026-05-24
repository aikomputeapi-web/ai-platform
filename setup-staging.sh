#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Staging One-Command Setup
# ══════════════════════════════════════════════════════════════════════════════
#
#  Usage:
#    chmod +x setup-staging.sh deploy-staging.sh manage-staging.sh
#    sudo ./setup-staging.sh
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.staging"

log()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
error()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()   { echo -e "${BLUE}[i]${NC} $1"; }
header() { echo -e "\n${CYAN}${BOLD}═══ $1 ═══${NC}\n"; }
gen_hex()    { openssl rand -hex 32; }
gen_base64() { openssl rand -base64 48; }
gen_pass()   { openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16; }

[[ $EUID -ne 0 ]] && error "Run as root: sudo ./setup-staging.sh"

# ══════════════════════════════════════════════════════════════════════════════
# Step 1: Dependencies
# ═══════════════════════════════════════════════════════════════════════════

header "Step 1/5 — Installing Dependencies"

. /etc/os-release 2>/dev/null || error "Requires Ubuntu/Debian"
apt-get update -qq

apt-get install -y -qq ca-certificates curl gnupg lsb-release openssl jq wget ufw > /dev/null 2>&1
log "Base packages"

if ! command -v docker &>/dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/${ID}/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /dev/null 2>&1
    systemctl enable docker && systemctl start docker
fi
log "Docker $(docker --version | grep -oP '\d+\.\d+\.\d+')"
docker compose version &>/dev/null || error "Docker Compose v2 not found"

command -v nginx &>/dev/null || { apt-get install -y -qq nginx > /dev/null 2>&1; systemctl enable nginx; }
log "Nginx"

command -v certbot &>/dev/null || apt-get install -y -qq certbot python3-certbot-nginx > /dev/null 2>&1
log "Certbot"

# ══════════════════════════════════════════════════════════════════════════════
# Step 2: OS Tuning
# ══════════════════════════════════════════════════════════════════════════════

header "Step 2/5 — Tuning OS for 1000+ Connections"

cat > /etc/sysctl.d/99-ai-platform.conf << 'EOF'
net.core.somaxconn = 4096
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_keepalive_time = 120
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535
fs.file-max = 2097152
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 8192
EOF
sysctl -p /etc/sysctl.d/99-ai-platform.conf > /dev/null 2>&1
log "TCP tuning applied"

cat > /etc/security/limits.d/99-ai-platform.conf << 'EOF'
* soft nofile 65535
* hard nofile 65535
* root soft nofile 65535
* root hard nofile 65535
EOF
log "File descriptors → 65535"

mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
{
    "default-ulimits": { "nofile": { "Name": "nofile", "Hard": 65535, "Soft": 65535 } },
    "log-driver": "json-file",
    "log-opts": { "max-size": "50m", "max-file": "5" },
    "storage-driver": "overlay2"
}
EOF
systemctl restart docker
log "Docker daemon tuned"

# ══════════════════════════════════════════════════════════════════════════════
# Step 3: Configuration
# ══════════════════════════════════════════════════════════════════════════════

header "Step 3/5 — Configuration (Staging)"

PUBLIC_IP=$(curl -sf --max-time 5 https://api.ipify.org 2>/dev/null || curl -sf --max-time 5 https://ifconfig.me 2>/dev/null || echo "unknown")

echo -e "  ${BOLD}Single staging domain setup.${NC} One URL for everything staging."
echo ""
echo -e "    ${CYAN}staging.yourdomain.com${NC}      → Your staging customer portal / admin dashboard"
echo -e "    ${CYAN}staging.yourdomain.com/v1${NC}   → Staging API for testing"
echo ""
echo -e "  Point your staging domain's A record to: ${GREEN}${PUBLIC_IP}${NC}"
echo ""

read -rp "  Staging Domain (e.g. aikompute.indevs.in): " DOMAIN
[[ -z "${DOMAIN}" ]] && error "Staging Domain required"

read -rp "  Email for SSL cert: " CERT_EMAIL
read -rp "  Skip SSL? local testing only (y/N): " SKIP_SSL
SKIP_SSL=${SKIP_SSL:-n}

echo ""
log "Staging Domain: ${DOMAIN}"

# ── Generate .env.staging ──
[[ -f "${ENV_FILE}" ]] && cp "${ENV_FILE}" "${ENV_FILE}.bak.$(date +%s)"

ADMIN_PASS="staging-$(gen_pass)"
PG_PASS=$(gen_hex)
REDIS_PASS=$(gen_hex)
OMNI_JWT=$(gen_base64)
OMNI_API_KEY=$(gen_hex)
OMNI_ENC=$(gen_hex)
PORTAL_JWT=$(gen_base64)
PORTAL_ADMIN_API_SECRET="staging-$(gen_hex | head -c 16)"
NEXTAUTH_SECRET=$(gen_base64)

cat > "${ENV_FILE}" << ENV
# AI Platform — Staging Environment
# ⚠️  DO NOT COMMIT — contains secrets
# Generated $(date -u +"%Y-%m-%dT%H:%M:%SZ")

DOMAIN=${DOMAIN}
PUBLIC_URL=https://${DOMAIN}
SSL_ENABLED=true

# PostgreSQL (isolated staging database via separate Docker volume)
POSTGRES_USER=aiplatform
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=aiplatform

# Redis
REDIS_PASSWORD=${REDIS_PASS}

# OmniRoute (all secrets are staging-specific, separate from production)
OMNIROUTE_JWT_SECRET=${OMNI_JWT}
OMNIROUTE_API_KEY_SECRET=${OMNI_API_KEY}
OMNIROUTE_INITIAL_PASSWORD=${ADMIN_PASS}
OMNIROUTE_STORAGE_ENCRYPTION_KEY=${OMNI_ENC}
OMNIROUTE_DASHBOARD_PORT=20128
OMNIROUTE_API_PORT=20129

# Customer Portal
PORTAL_JWT_SECRET=${PORTAL_JWT}
PORTAL_PORT=3000
RESEND_API_KEY=
EMAIL_FROM=staging@${DOMAIN}
ADMIN_API_SECRET=${PORTAL_ADMIN_API_SECRET}
NEXT_PUBLIC_APP_URL=https://${DOMAIN}
NEXT_PUBLIC_APP_NAME="aikompute [STAGING]"

# Stripe — DISABLED in staging by default
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_PRO=
STRIPE_PRICE_ID_MAX_5X=
STRIPE_PRICE_ID_MAX_20X=

DATABASE_URL="postgresql://aiplatform:${PG_PASS}@postgres:5432/aiplatform"
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV

chmod 600 "${ENV_FILE}"
[[ -n "${SUDO_USER:-}" ]] && chown "${SUDO_USER}:${SUDO_USER}" "${ENV_FILE}"
log "Staging secrets generated"

echo ""
echo -e "  ┌─────────────────────────────────────────────────┐"
# Print password box
echo -e "  │  ${BOLD}Staging Admin Password: ${YELLOW}${ADMIN_PASS}${NC}       │"
echo -e "  └─────────────────────────────────────────────────┘"
echo ""
warn "SAVE THIS. You need it to log into your staging dashboard."

# ══════════════════════════════════════════════════════════════════════════════
# Step 4: Nginx + SSL + Firewall
# ══════════════════════════════════════════════════════════════════════════════

header "Step 4/5 — Nginx + SSL"

mkdir -p /var/www/certbot

if [[ "${SKIP_SSL,,}" == "y" ]]; then
    CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
    mkdir -p "${CERT_DIR}"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "${CERT_DIR}/privkey.pem" \
        -out "${CERT_DIR}/fullchain.pem" \
        -subj "/CN=${DOMAIN}" 2>/dev/null
    log "Self-signed cert (testing only)"
    # Update .env.staging for non-SSL
    sed -i 's/SSL_ENABLED=true/SSL_ENABLED=false/' "${ENV_FILE}"
    sed -i "s|PUBLIC_URL=https://${DOMAIN}|PUBLIC_URL=http://${DOMAIN}|" "${ENV_FILE}"
else
    systemctl stop nginx 2>/dev/null || true
    certbot certonly --standalone --non-interactive --agree-tos \
        --email "${CERT_EMAIL}" -d "${DOMAIN}" -d "admin.${DOMAIN}" 2>/dev/null || {
        warn "Let's Encrypt failed. Is an A record for ${DOMAIN} and admin.${DOMAIN} pointing to ${PUBLIC_IP}?"
        warn "Falling back to self-signed cert."
        CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
        mkdir -p "${CERT_DIR}"
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "${CERT_DIR}/privkey.pem" \
            -out "${CERT_DIR}/fullchain.pem" \
            -subj "/CN=${DOMAIN}" 2>/dev/null
    }
    log "SSL ready (staging domain + admin subdomain)"

    # Auto-renewal
    { crontab -l 2>/dev/null | grep -v certbot || true; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'"; } | crontab -
    log "Auto-renewal scheduled"
fi

# Firewall
ufw --force reset > /dev/null 2>&1
ufw default deny incoming > /dev/null 2>&1
ufw default allow outgoing > /dev/null 2>&1
ufw allow 22/tcp > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1
log "Firewall: SSH + HTTP/HTTPS only"

# ══════════════════════════════════════════════════════════════════════════════
# Step 5: Build and launch
# ══════════════════════════════════════════════════════════════════════════════

header "Step 5/5 — Building & Starting Staging Stack"

# Initialize OmniRoute/.env.staging if not present
if [[ ! -f "./OmniRoute/.env.staging" ]] && [[ -f "./OmniRoute/.env.example" ]]; then
    cp "./OmniRoute/.env.example" "./OmniRoute/.env.staging"
fi

# Make scripts executable and trigger staging deploy
chmod +x deploy-staging.sh manage-staging.sh
./deploy-staging.sh

echo ""
echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║                🚀  STAGING IS LIVE!                           ║${NC}"
echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Staging Customer Portal (public-facing):${NC}"
echo -e "    ${GREEN}https://${DOMAIN}${NC}"
echo ""
echo -e "  ${BOLD}Staging Admin Dashboard (private):${NC}"
echo -e "    ${GREEN}https://admin.${DOMAIN}${NC}"
echo -e "    Password: ${YELLOW}${ADMIN_PASS}${NC}"
echo ""
echo -e "  ${BOLD}Staging API Endpoint (test completions here):${NC}"
echo -e "    ${GREEN}https://${DOMAIN}/v1${NC}"
echo ""
echo -e "  ${BOLD}Staging Management:${NC}"
echo -e "    ${BLUE}./manage-staging.sh status${NC}  — Staging service health"
echo -e "    ${BLUE}./manage-staging.sh logs${NC}    — View staging logs"
echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""
