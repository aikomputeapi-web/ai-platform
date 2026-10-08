#!/usr/bin/env bash
# setup-new-server.sh — one-shot bootstrap for the unified ai-platform stack on a fresh Ubuntu box.
# Usage (as root, on the new server):  bash setup-new-server.sh [DOMAIN]
# Prereq: repo already rsynced/cloned to /opt/ai-platform (or adjust REPO_DIR below).
set -euo pipefail

DOMAIN="${1:-aikompute.com}"
REPO_DIR="/opt/ai-platform"
ENV_FILE="$REPO_DIR/.env.unified"
COMPOSE_FILE="$REPO_DIR/docker-compose.unified.yml"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "run as root"; exit 1; }
[[ -d "$REPO_DIR" ]] || { echo "repo not found at $REPO_DIR — rsync or git clone it there first"; exit 1; }

# 1. Base tooling
log "installing base packages"
apt-get update -qq
apt-get install -y -qq nginx git curl ufw certbot python3-certbot-nginx >/dev/null

# 2. Docker
if ! command -v docker >/dev/null 2>&1; then
  log "installing docker"
  curl -fsSL https://get.docker.com | sh
else
  log "docker already present"
fi
docker compose version >/dev/null 2>&1 || { echo "docker compose plugin missing"; exit 1; }

# 3. Environment file
if [[ ! -f "$ENV_FILE" ]]; then
  log "scaffolding .env.unified from example (edit before going live)"
  cp "$REPO_DIR/.env.unified.example" "$ENV_FILE"
  # set the domain the user passed
  sed -i "s|^DOMAIN=.*|DOMAIN=$DOMAIN|; s|^PUBLIC_URL=.*|PUBLIC_URL=https://$DOMAIN|" "$ENV_FILE"
  echo "  !! EDIT $ENV_FILE — fill all secrets (DB password, admin secret, OAuth, etc)"
else
  log ".env.unified already exists, leaving it alone"
fi

# 4. Build + start the stack
log "building and starting containers"
cd "$REPO_DIR"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --parallel
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

# 5. Prisma migrations (fresh volume needs migrate deploy)
log "applying prisma migrations"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" \
  run --no-deps --rm customer-portal \
  sh -c "node node_modules/prisma/build/index.js migrate deploy" \
  && log "migrations ok" || echo "  !! migrate deploy failed — check DB service and POSTGRES_* env"

# 6. Nginx
log "installing nginx config"
sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$REPO_DIR/nginx/nginx.conf" > /etc/nginx/nginx.conf
nginx -t
systemctl enable --now nginx
systemctl reload nginx

# 7. TLS (only works once DNS points here)
log "requesting TLS cert for $DOMAIN (skips automatically if DNS not pointed yet)"
if dig +short "$DOMAIN" | grep -q "$(curl -s ipv4.icanhazip.com)"; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" || echo "  !! certbot failed — rerun after DNS propagation"
else
  echo "  !! DNS for $DOMAIN does not point here yet — update the A record, then run:"
  echo "     certbot --nginx -d $DOMAIN"
fi

# 8. Firewall
log "configuring ufw (22/80/443)"
ufw --force reset >/dev/null
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log "done. current stack:"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}"
