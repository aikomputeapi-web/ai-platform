#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — One-Command Setup
# ══════════════════════════════════════════════════════════════════════════════
#
#  Single dashboard. One domain. All providers in one place.
#
#  Usage:
#    chmod +x setup.sh manage.sh
#    sudo ./setup.sh
#
#  What you get:
#    yourdomain.com       → Your admin dashboard (add all accounts here)
#    yourdomain.com/v1    → OpenAI-compatible API (users connect here)
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

log()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
error()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()   { echo -e "${BLUE}[i]${NC} $1"; }
header() { echo -e "\n${CYAN}${BOLD}═══ $1 ═══${NC}\n"; }
gen_hex()    { openssl rand -hex 32; }
gen_base64() { openssl rand -base64 48; }
gen_pass()   { openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16; }

[[ $EUID -ne 0 ]] && error "Run as root: sudo ./setup.sh"

# ══════════════════════════════════════════════════════════════════════════════
# Step 1: Dependencies
# ══════════════════════════════════════════════════════════════════════════════

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
root soft nofile 65535
root hard nofile 65535
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

header "Step 3/5 — Configuration"

PUBLIC_IP=$(curl -sf --max-time 5 https://api.ipify.org 2>/dev/null || curl -sf --max-time 5 https://ifconfig.me 2>/dev/null || echo "unknown")

echo -e "  ${BOLD}Single domain setup.${NC} One URL for everything."
echo ""
echo -e "    ${CYAN}yourdomain.com${NC}      → Your admin dashboard"
echo -e "    ${CYAN}yourdomain.com/v1${NC}   → API for your users"
echo ""
echo -e "  Free domains from StackRyze (indevs.in, sryze.cc) work."
echo -e "  Point an A record to: ${GREEN}${PUBLIC_IP}${NC}"
echo ""

read -rp "  Domain (e.g. aiapi.indevs.in): " DOMAIN
[[ -z "${DOMAIN}" ]] && error "Domain required"

read -rp "  Email for SSL cert: " CERT_EMAIL
read -rp "  Skip SSL? local testing only (y/N): " SKIP_SSL
SKIP_SSL=${SKIP_SSL:-n}

echo ""
log "Domain: ${DOMAIN}"

# ── Generate .env ──
[[ -f "${ENV_FILE}" ]] && cp "${ENV_FILE}" "${ENV_FILE}.bak.$(date +%s)"

ADMIN_PASS="admin-$(gen_pass)"

cat > "${ENV_FILE}" << ENV
# AI Platform — Auto-Generated $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ⚠️  DO NOT COMMIT

DOMAIN=${DOMAIN}
PUBLIC_URL=https://${DOMAIN}
SSL_ENABLED=true

# PostgreSQL
POSTGRES_USER=aiplatform
POSTGRES_PASSWORD=$(gen_hex)
POSTGRES_DB=aiplatform

# Redis
REDIS_PASSWORD=$(gen_hex)

# OmniRoute
OMNIROUTE_JWT_SECRET=$(gen_base64)
OMNIROUTE_API_KEY_SECRET=$(gen_hex)
OMNIROUTE_INITIAL_PASSWORD=${ADMIN_PASS}
OMNIROUTE_STORAGE_ENCRYPTION_KEY=$(gen_hex)
OMNIROUTE_DASHBOARD_PORT=20128
OMNIROUTE_API_PORT=20129

# Customer Portal
PORTAL_JWT_SECRET=$(gen_base64)
PORTAL_PORT=3000
RESEND_API_KEY=
EMAIL_FROM=noreply@${DOMAIN}
ENV

chmod 600 "${ENV_FILE}"
log "Secrets generated"

echo ""
echo -e "  ┌─────────────────────────────────────────────────┐"
echo -e "  │  ${BOLD}Admin Password: ${YELLOW}${ADMIN_PASS}${NC}               │"
echo -e "  └─────────────────────────────────────────────────┘"
echo ""
warn "SAVE THIS. You need it to log into your dashboard."

# ══════════════════════════════════════════════════════════════════════════════
# Step 4: Nginx + SSL + Firewall
# ══════════════════════════════════════════════════════════════════════════════

header "Step 4/5 — Nginx + SSL"

mkdir -p /var/www/certbot
cp "${SCRIPT_DIR}/nginx/nginx.conf" /etc/nginx/nginx.conf
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" /etc/nginx/nginx.conf
log "Nginx configured for ${DOMAIN}"

if [[ "${SKIP_SSL,,}" == "y" ]]; then
    CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
    mkdir -p "${CERT_DIR}"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "${CERT_DIR}/privkey.pem" \
        -out "${CERT_DIR}/fullchain.pem" \
        -subj "/CN=${DOMAIN}" 2>/dev/null
    log "Self-signed cert (testing only)"
    # Update .env for non-SSL
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
    log "SSL ready (domain + admin subdomain)"

    # Auto-renewal
    (crontab -l 2>/dev/null | grep -v certbot; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
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

nginx -t 2>/dev/null && { systemctl start nginx; systemctl enable nginx; log "Nginx started"; } || { error "Nginx config test failed"; }

# ══════════════════════════════════════════════════════════════════════════════
# Step 5: Build and launch
# ══════════════════════════════════════════════════════════════════════════════

header "Step 5/5 — Building & Starting"

cd "${SCRIPT_DIR}"

# Bootstrap OmniRoute .env
if [[ ! -f "./OmniRoute/.env" ]] && [[ -f "./OmniRoute/.env.example" ]]; then
    cp "./OmniRoute/.env.example" "./OmniRoute/.env"

    # Inject our generated secrets into OmniRoute's .env
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(grep OMNIROUTE_JWT_SECRET ${ENV_FILE} | cut -d= -f2)|" ./OmniRoute/.env
    sed -i "s|^API_KEY_SECRET=.*|API_KEY_SECRET=$(grep OMNIROUTE_API_KEY_SECRET ${ENV_FILE} | cut -d= -f2)|" ./OmniRoute/.env
    sed -i "s|^INITIAL_PASSWORD=.*|INITIAL_PASSWORD=${ADMIN_PASS}|" ./OmniRoute/.env
    sed -i "s|^STORAGE_ENCRYPTION_KEY=.*|STORAGE_ENCRYPTION_KEY=$(grep OMNIROUTE_STORAGE_ENCRYPTION_KEY ${ENV_FILE} | cut -d= -f2)|" ./OmniRoute/.env

    # Set public URL for OAuth callbacks
    PUBLIC=$(grep PUBLIC_URL ${ENV_FILE} | cut -d= -f2)
    sed -i "s|^NEXT_PUBLIC_BASE_URL=.*|NEXT_PUBLIC_BASE_URL=${PUBLIC}|" ./OmniRoute/.env
    sed -i "s|^BASE_URL=.*|BASE_URL=${PUBLIC}|" ./OmniRoute/.env

    # Enable all anti-detection
    sed -i 's|^# CLI_COMPAT_ALL=.*|CLI_COMPAT_ALL=1|' ./OmniRoute/.env

    log "OmniRoute .env configured"
fi

info "Building images (first run takes 5-10 min)..."
docker compose -f docker-compose.unified.yml build --parallel 2>&1 | tail -3

info "Starting services..."
docker compose -f docker-compose.unified.yml up -d

log "Waiting for services..."
sleep 15

echo ""
docker compose -f docker-compose.unified.yml ps --format "table {{.Name}}\t{{.Status}}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# Done!
# ══════════════════════════════════════════════════════════════════════════════

PROTO="https"
[[ "${SKIP_SSL,,}" == "y" ]] && PROTO="https (self-signed)"

echo ""
echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║                    🚀  YOU'RE LIVE!                           ║${NC}"
echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Customer Portal (public-facing):${NC}"
echo -e "    ${GREEN}${PROTO}://${DOMAIN}${NC}"
echo -e "    Sign up page: ${GREEN}${PROTO}://${DOMAIN}/signup${NC}"
echo ""
echo -e "  ${BOLD}Admin Dashboard (private):${NC}"
echo -e "    ${GREEN}${PROTO}://admin.${DOMAIN}${NC}"
echo -e "    Password: ${YELLOW}${ADMIN_PASS}${NC}"
echo ""
echo -e "  ${BOLD}API Endpoint (give this to users):${NC}"
echo -e "    ${GREEN}${PROTO}://${DOMAIN}/v1${NC}"
echo ""
echo -e "  ${BOLD}Quick setup steps:${NC}"
echo -e "    1. Go to ${CYAN}${PROTO}://admin.${DOMAIN}${NC} and log in"
echo -e "    2. Click ${BOLD}Providers${NC} and add all your AI accounts"
echo -e "    3. Add ${BOLD}RESEND_API_KEY${NC} to .env for email verification"
echo -e "    4. Add ${BOLD}STRIPE_SECRET_KEY${NC} to .env for payments"
echo -e "    5. Share ${GREEN}${PROTO}://${DOMAIN}${NC} with your customers"
echo ""
echo -e "  ${BOLD}Management:${NC}"
echo -e "    ${BLUE}./manage.sh status${NC}  — Service health"
echo -e "    ${BLUE}./manage.sh logs${NC}    — View logs"
echo -e "    ${BLUE}./manage.sh backup${NC}  — Full backup"
echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""
