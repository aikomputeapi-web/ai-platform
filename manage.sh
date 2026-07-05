#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Management Script
# ══════════════════════════════════════════════════════════════════════════════
#
#  Usage: ./manage.sh <command>
#
#  Commands:
#    status      Health dashboard
#    logs        Tail all logs
#    logs <svc>  Tail one service (omniroute, postgres, redis)
#    restart     Restart all
#    restart <s> Restart one service
#    stop / start / rebuild
#    backup      Full backup (DB + volumes + .env)
#    restore <f> Restore from backup
#    health      HTTP endpoint checks
#    shell <svc> Shell into container
#    update      Pull latest + rebuild
#    ssl-renew   Force cert renewal
#    cleanup     Prune old images/logs
#    bg:status   Blue-green slot status
#    bg:switch   Perform blue-green deploy (delegate to scripts/blue-green-switch.sh)
#    bg:rollback Rollback to previous blue-green slot
#    bg:cleanup  Remove old blue-green environment
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.unified.yml"
ENV_FILE="${SCRIPT_DIR}/.env"
BACKUP_DIR="${SCRIPT_DIR}/backups"
NGINX_CONF="/etc/nginx/nginx.conf"

dc() { docker compose -f "${COMPOSE_FILE}" "$@"; }

cmd_status() {
    echo ""
    echo -e "${CYAN}${BOLD}═══ Service Status ═══${NC}"
    echo ""
    dc ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""

    echo -e "${BOLD}Health:${NC}"
    for svc in "OmniRoute Dashboard:20128/" "OmniRoute API:20129/v1/models" "Customer Portal:3000/api/health"; do
        local entry="${svc##*:}"
        local name="${svc%%:*}"
        local port="${entry%%/*}"
        local path="/${entry#*/}"
        local code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:${port}${path}" 2>/dev/null || echo "000")
        if [[ "${code}" =~ ^(200|302|307|308|401)$ ]]; then
            echo -e "  ${GREEN}●${NC} ${name} — ${GREEN}OK${NC}"
        else
            echo -e "  ${RED}●${NC} ${name} — ${RED}Down${NC} (HTTP ${code})"
        fi
    done

    # PostgreSQL (External / Cloud SQL) — check socket connection
    local db_url=$(grep "^DATABASE_URL=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || echo "")
    if [[ -n "${db_url}" ]]; then
        local db_host=$(echo "${db_url}" | sed -E 's/.*@([^:]+):.*/\1/')
        local db_port=$(echo "${db_url}" | sed -E 's/.*:([0-9]+)\/.*/\1/' | cut -d/ -f1)
        if nc -w 3 -z "${db_host}" "${db_port}" &>/dev/null; then
            echo -e "  ${GREEN}●${NC} PostgreSQL — ${GREEN}Ready${NC}"
        else
            echo -e "  ${RED}●${NC} PostgreSQL — ${RED}Down${NC}"
        fi
    else
        echo -e "  ${RED}●${NC} PostgreSQL — ${RED}Down (No URL)${NC}"
    fi

    # Redis (External / Memorystore) — check remote ping (with TLS if rediss://)
    local redis_url=$(grep "^REDIS_URL=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || echo "")
    local redis_pwd=$(grep "^REDIS_PASSWORD=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || echo "")
    if [[ -n "${redis_url}" ]]; then
        local redis_host=$(echo "${redis_url}" | sed 's/.*@//;s/:6379.*//')
        local redis_tls=""
        if [[ "${redis_url}" =~ ^rediss:// ]]; then
            redis_tls="--tls"
        fi
        redis-cli ${redis_tls} -h "${redis_host}" -a "${redis_pwd}" ping 2>/dev/null | grep -q PONG && \
            echo -e "  ${GREEN}●${NC} Redis (Memorystore) — ${GREEN}PONG${NC}" || \
            echo -e "  ${RED}●${NC} Redis (Memorystore) — ${RED}Down${NC}"
    else
        echo -e "  ${RED}●${NC} Redis (Memorystore) — ${RED}Down (No URL)${NC}"
    fi

    echo ""
    echo -e "${BOLD}Resources:${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" \
        $(dc ps -q 2>/dev/null) 2>/dev/null || true
    echo ""
}

cmd_logs() {
    local svc="${1:-}"
    if [[ -z "${svc}" ]]; then
        dc logs -f --tail 50
    else
        dc logs -f --tail 100 "${svc}"
    fi
}

cmd_restart() {
    local svc="${1:-}"
    if [[ -z "${svc}" ]]; then
        dc restart
    else
        dc restart "${svc}"
    fi
}

cmd_stop()    { dc down; }
cmd_start()   { dc up -d; }
cmd_rebuild() { dc down; dc build --parallel; dc up -d; }
cmd_update()  {
    # Ensure OmniRoute source is present & up to date (standalone repo, not a submodule)
    local setup="${SCRIPT_DIR}/scripts/setup-omniroute.sh"
    if [[ -x "${setup}" ]]; then
        echo -e "${BLUE}[i]${NC} Ensuring OmniRoute source (setup-omniroute.sh)…"
        bash "${setup}" || { echo -e "${RED}[✗]${NC} OmniRoute bootstrap failed"; return 1; }
    fi
    # Pull latest OmniRoute from its own fork (origin/main)
    if [[ -d "${SCRIPT_DIR}/OmniRoute/.git" ]]; then
        echo -e "${BLUE}[i]${NC} Pulling OmniRoute origin/main…"
        ( cd "${SCRIPT_DIR}/OmniRoute" && git pull --ff-only ) || echo -e "${YELLOW}[!]${NC} OmniRoute pull skipped"

        # Fetch updates from the original creator's upstream repo so they can
        # be merged deliberately (may need conflict resolution). We do NOT
        # auto-merge here — only fetch and report whether new commits exist.
        if ( cd "${SCRIPT_DIR}/OmniRoute" && git remote get-url upstream ) >/dev/null 2>&1; then
            echo -e "${BLUE}[i]${NC} Fetching OmniRoute upstream (original creator)…"
            if ( cd "${SCRIPT_DIR}/OmniRoute" && git fetch upstream ); then
                local omni_behind
                omni_behind=$( cd "${SCRIPT_DIR}/OmniRoute" && git rev-list --count HEAD..upstream/main 2>/dev/null || echo 0 )
                if [[ "${omni_behind}" -gt 0 ]]; then
                    echo -e "${YELLOW}[!]${NC} OmniRoute is ${omni_behind} commit(s) behind upstream/main."
                    echo -e "${YELLOW}[!]${NC} Merge with:  cd OmniRoute && git merge upstream/main"
                else
                    echo -e "${GREEN}[✓]${NC} OmniRoute is up to date with upstream/main"
                fi
            else
                echo -e "${YELLOW}[!]${NC} OmniRoute upstream fetch skipped"
            fi
        fi
    fi
    dc pull; dc build --parallel; dc up -d
}

cmd_backup() {
    local TS=$(date +%Y%m%d_%H%M%S)
    local BK="${BACKUP_DIR}/${TS}"
    mkdir -p "${BK}"

    cp "${ENV_FILE}" "${BK}/.env"

    # PostgreSQL is external (GCP Cloud SQL) — backup via pg_dump if local, else via DATABASE_URL
    if docker compose -f "${COMPOSE_FILE}" ps --filter "name=postgres" --format "{{.Name}}" 2>/dev/null | grep -q postgres; then
        dc exec -T postgres pg_dump -U aiplatform aiplatform > "${BK}/postgres.sql" 2>/dev/null || warn "PostgreSQL dump failed"
    else
        local db_url=$(grep "^DATABASE_URL=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || echo "")
        if [[ -n "${db_url}" ]]; then
            info "PostgreSQL is external — attempting remote pg_dump via DATABASE_URL"
            pg_dump "${db_url}" > "${BK}/postgres.sql" 2>/dev/null || warn "Remote PostgreSQL dump failed (is pg_dump installed and network accessible?)"
        else
            warn "PostgreSQL backup skipped — external service with no DATABASE_URL"
        fi
    fi

    # Redis is external (GCP Memorystore) — backup via remote redis-cli
    local redis_url=$(grep "^REDIS_URL=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || echo "")
    local redis_pwd=$(grep "^REDIS_PASSWORD=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || echo "")
    if [[ -n "${redis_url}" ]]; then
        local redis_host=$(echo "${redis_url}" | sed 's/.*@//;s/:6379.*//')
        local redis_tls=""
        if [[ "${redis_url}" =~ ^rediss:// ]]; then
            redis_tls="--tls"
        fi
        redis-cli ${redis_tls} -h "${redis_host}" -a "${redis_pwd}" --rdb "${BK}/redis.rdb" 2>/dev/null || warn "Redis backup failed"
    else
        warn "Redis backup skipped — no REDIS_URL"
    fi

    for vol in omniroute-data; do
        docker run --rm -v "ai-${vol}:/src:ro" -v "${BK}:/bk" alpine tar cf "/bk/${vol}.tar" -C /src . 2>/dev/null || true
    done

    tar czf "${BACKUP_DIR}/backup_${TS}.tar.gz" -C "${BACKUP_DIR}" "${TS}"
    rm -rf "${BK}"

    echo -e "${GREEN}[✓]${NC} Backup: ${BACKUP_DIR}/backup_${TS}.tar.gz ($(du -sh "${BACKUP_DIR}/backup_${TS}.tar.gz" | cut -f1))"

    ls -t "${BACKUP_DIR}"/backup_*.tar.gz 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null || true
}

cmd_restore() {
    local f="${1:-}"
    [[ -z "${f}" ]] && { ls -lh "${BACKUP_DIR}"/backup_*.tar.gz 2>/dev/null || echo "No backups."; echo "Usage: ./manage.sh restore <file>"; return 1; }
    [[ ! -f "${f}" ]] && { echo "Not found: ${f}"; return 1; }

    read -rp "This will OVERWRITE data. Type YES: " c
    [[ "${c}" != "YES" ]] && return

    dc down
    local tmp=$(mktemp -d); tar xzf "${f}" -C "${tmp}"; local d="${tmp}/$(ls "${tmp}")"

    [[ -f "${d}/.env" ]] && cp "${d}/.env" "${ENV_FILE}"
    dc up -d postgres; sleep 5
    [[ -f "${d}/postgres.sql" ]] && dc exec -T postgres psql -U aiplatform -d aiplatform < "${d}/postgres.sql"

    for vol in omniroute-data; do
        [[ -f "${d}/${vol}.tar" ]] && docker run --rm -v "ai-${vol}:/dst" -v "${d}:/bk:ro" alpine sh -c "rm -rf /dst/* && tar xf /bk/${vol}.tar -C /dst"
    done

    rm -rf "${tmp}"; dc up -d
    echo -e "${GREEN}[✓]${NC} Restored!"
}

cmd_health() {
    echo ""
    for ep in "Dashboard|http://127.0.0.1:20128" "API|http://127.0.0.1:20129/v1/models"; do
        local n="${ep%%|*}" u="${ep##*|}"
        local s=$(date +%s%N)
        local c=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 "${u}" 2>/dev/null || echo "000")
        local ms=$(( ($(date +%s%N) - s) / 1000000 ))
        [[ "${c}" =~ ^2 ]] && echo -e "  ${GREEN}●${NC} ${n}: ${c} (${ms}ms)" || echo -e "  ${RED}●${NC} ${n}: ${c}"
    done
    echo ""
}

cmd_shell() {
    local svc="${1:-}"
    [[ -z "${svc}" ]] && { echo "Usage: ./manage.sh shell <omniroute|postgres|redis>"; return 1; }
    dc exec "${svc}" sh -c 'command -v bash >/dev/null && bash || sh'
}

cmd_ssl_renew() { certbot renew --force-renewal --post-hook "systemctl reload nginx"; }
cmd_cleanup()   { docker image prune -f; docker volume prune -f; docker builder prune -f; find "${SCRIPT_DIR}" -name "*.log" -mtime +30 -delete 2>/dev/null; }

# ══════════════════════════════════════════════════════════════════════════════
# Blue-Green Management Commands
# ══════════════════════════════════════════════════════════════════════════════

cmd_bg_status() {
    echo ""
    echo -e "${CYAN}${BOLD}═══ Blue-Green Status ═══${NC}"
    echo ""

    # Read active slot from .env
    local active_slot=""
    if [[ -f "${ENV_FILE}" ]]; then
        active_slot=$(grep "^ACTIVE_SLOT=" "${ENV_FILE}" | cut -d= -f2- | tr -d '[:space:]')
    fi
    if [[ -z "${active_slot}" ]]; then
        active_slot="unknown"
    fi
    echo -e "${BOLD}Active slot:${NC} ${active_slot^^}"
    echo ""

    # Get running container names
    local running_names
    running_names=$(docker ps --format '{{.Names}}' 2>/dev/null || true)

    # Blue slot
    echo -e "${BOLD}Blue (ports 20128/20129/3000):${NC}"
    if echo "${running_names}" | grep -q "^omniroute$" 2>/dev/null; then
        echo -e "  ${GREEN}●${NC} omniroute — $(docker inspect --format '{{.State.Health.Status}}' omniroute 2>/dev/null || echo 'unknown')"
    else
        echo -e "  ${RED}●${NC} omniroute — not running"
    fi
    if echo "${running_names}" | grep -q "^customer-portal$" 2>/dev/null; then
        echo -e "  ${GREEN}●${NC} customer-portal — $(docker inspect --format '{{.State.Health.Status}}' customer-portal 2>/dev/null || echo 'unknown')"
    else
        echo -e "  ${RED}●${NC} customer-portal — not running"
    fi
    local bc1=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:20128/ 2>/dev/null || echo "000")
    local bc2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:20129/v1/models 2>/dev/null || echo "000")
    local bc3=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:3000/api/health 2>/dev/null || echo "000")
    echo -e "  Dashboard: HTTP ${bc1}  |  API: HTTP ${bc2}  |  Portal: HTTP ${bc3}"
    echo ""

    # Green slot
    echo -e "${BOLD}Green (ports 20138/20139/3001):${NC}"
    if echo "${running_names}" | grep -q "^omniroute-green$" 2>/dev/null; then
        echo -e "  ${GREEN}●${NC} omniroute-green — $(docker inspect --format '{{.State.Health.Status}}' omniroute-green 2>/dev/null || echo 'unknown')"
    else
        echo -e "  ${RED}●${NC} omniroute-green — not running"
    fi
    if echo "${running_names}" | grep -q "^customer-portal-green$" 2>/dev/null; then
        echo -e "  ${GREEN}●${NC} customer-portal-green — $(docker inspect --format '{{.State.Health.Status}}' customer-portal-green 2>/dev/null || echo 'unknown')"
    else
        echo -e "  ${RED}●${NC} customer-portal-green — not running"
    fi
    local gc1=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:20138/ 2>/dev/null || echo "000")
    local gc2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:20139/v1/models 2>/dev/null || echo "000")
    local gc3=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:3001/api/health 2>/dev/null || echo "000")
    echo -e "  Dashboard: HTTP ${gc1}  |  API: HTTP ${gc2}  |  Portal: HTTP ${gc3}"
    echo ""

    # Volumes
    echo -e "${BOLD}Volumes:${NC}"
    docker volume ls --filter "name=omniroute" --format "  {{.Name}}" 2>/dev/null || echo "  (none)"
    echo ""

    # Nginx upstream status
    echo -e "${BOLD}Nginx upstreams:${NC}"
    sudo grep -n "server 127.0.0.1:" "${NGINX_CONF}" 2>/dev/null || echo "  (unable to read)"
    echo ""
}

cmd_bg_switch() {
    echo -e "${BLUE}[i]${NC} Starting blue-green deploy..."
    if [[ ! -x "${SCRIPT_DIR}/scripts/blue-green-switch.sh" ]]; then
        error "scripts/blue-green-switch.sh not found or not executable"
    fi
    bash "${SCRIPT_DIR}/scripts/blue-green-switch.sh"
}

cmd_bg_rollback() {
    echo -e "${BLUE}[i]${NC} Starting blue-green rollback..."
    if [[ ! -x "${SCRIPT_DIR}/scripts/blue-green-rollback.sh" ]]; then
        error "scripts/blue-green-rollback.sh not found or not executable"
    fi
    bash "${SCRIPT_DIR}/scripts/blue-green-rollback.sh"
}

cmd_bg_cleanup() {
    local target="${1:-}"
    if [[ -z "${target}" ]]; then
        echo -e "${YELLOW}Usage:${NC} ./manage.sh bg:cleanup <blue|green>"
        echo "  Specify which environment to clean up."
        return 1
    fi
    echo -e "${BLUE}[i]${NC} Cleaning up ${target^^} environment..."
    if [[ ! -x "${SCRIPT_DIR}/scripts/blue-green-cleanup.sh" ]]; then
        error "scripts/blue-green-cleanup.sh not found or not executable"
    fi
    bash "${SCRIPT_DIR}/scripts/blue-green-cleanup.sh" "${target}"
}

cmd_help() {
    echo -e "\n${BOLD}AI Platform Management${NC}\n"
    echo "  status          Service health + resources"
    echo "  start/stop      Start or stop all services"
    echo "  restart [svc]   Restart all or one"
    echo "  rebuild         Full rebuild"
    echo "  logs [svc]      Tail logs"
    echo "  health          HTTP checks"
    echo "  shell <svc>     Enter container"
    echo "  backup          Full backup"
    echo "  restore <file>  Restore"
    echo "  update          Pull + rebuild"
    echo "  ssl-renew       Force SSL renewal"
    echo "  cleanup         Prune old data"
    echo ""
    echo -e "${CYAN}Blue-Green Deployment:${NC}"
    echo "  bg:status       Show blue-green slot status"
    echo "  bg:switch       Perform blue-green deploy (zero-downtime)"
    echo "  bg:rollback     Rollback to previous slot"
    echo "  bg:cleanup <s>  Remove old environment (blue|green)"
    echo ""
}

case "${1:-help}" in
    status)     cmd_status ;;
    logs)       shift; cmd_logs "$@" ;;
    restart)    shift; cmd_restart "$@" ;;
    stop)       cmd_stop ;;
    start)      cmd_start ;;
    rebuild)    cmd_rebuild ;;
    backup)     cmd_backup ;;
    restore)    shift; cmd_restore "$@" ;;
    health)     cmd_health ;;
    shell)      shift; cmd_shell "$@" ;;
    ssl-renew)  cmd_ssl_renew ;;
    update)     cmd_update ;;
    cleanup)    cmd_cleanup ;;
    bg:status)  cmd_bg_status ;;
    bg:switch)  cmd_bg_switch ;;
    bg:rollback) cmd_bg_rollback ;;
    bg:cleanup) shift; cmd_bg_cleanup "$@" ;;
    *)          cmd_help ;;
esac
