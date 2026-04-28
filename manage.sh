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
#    logs <svc>  Tail one service (omniroute, cliproxyapi, postgres, redis)
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
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.unified.yml"
ENV_FILE="${SCRIPT_DIR}/.env"
BACKUP_DIR="${SCRIPT_DIR}/backups"

dc() { docker compose -f "${COMPOSE_FILE}" "$@"; }

cmd_status() {
    echo ""
    echo -e "${CYAN}${BOLD}═══ Service Status ═══${NC}"
    echo ""
    dc ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""

    echo -e "${BOLD}Health:${NC}"
    for svc in "OmniRoute Dashboard:20128" "OmniRoute API:20129" "Customer Portal:3000"; do
        local name="${svc%%:*}" port="${svc##*:}"
        if curl -sf -o /dev/null --max-time 3 "http://127.0.0.1:${port}" 2>/dev/null; then
            echo -e "  ${GREEN}●${NC} ${name} — ${GREEN}OK${NC}"
        else
            echo -e "  ${RED}●${NC} ${name} — ${RED}Down${NC}"
        fi
    done

    dc exec -T postgres pg_isready -U aiplatform &>/dev/null && \
        echo -e "  ${GREEN}●${NC} PostgreSQL — ${GREEN}Ready${NC}" || \
        echo -e "  ${RED}●${NC} PostgreSQL — ${RED}Down${NC}"

    dc exec -T redis redis-cli -a "$(grep REDIS_PASSWORD ${ENV_FILE} 2>/dev/null | cut -d= -f2-)" ping 2>/dev/null | grep -q PONG && \
        echo -e "  ${GREEN}●${NC} Redis — ${GREEN}PONG${NC}" || \
        echo -e "  ${RED}●${NC} Redis — ${RED}Down${NC}"

    echo ""
    echo -e "${BOLD}Resources:${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" \
        $(dc ps -q 2>/dev/null) 2>/dev/null || true
    echo ""
}

cmd_logs() {
    local svc="${1:-}"
    [[ -n "${svc}" ]] && dc logs -f --tail 100 "${svc}" || dc logs -f --tail 50
}

cmd_restart() {
    local svc="${1:-}"
    [[ -n "${svc}" ]] && dc restart "${svc}" || dc restart
}

cmd_stop()    { dc down; }
cmd_start()   { dc up -d; }
cmd_rebuild() { dc down; dc build --parallel; dc up -d; }
cmd_update()  { dc pull; dc build --parallel; dc up -d; }

cmd_backup() {
    local TS=$(date +%Y%m%d_%H%M%S)
    local BK="${BACKUP_DIR}/${TS}"
    mkdir -p "${BK}"

    cp "${ENV_FILE}" "${BK}/.env"

    dc exec -T postgres pg_dump -U aiplatform aiplatform > "${BK}/postgres.sql" 2>/dev/null || true

    dc exec -T redis redis-cli -a "$(grep REDIS_PASSWORD ${ENV_FILE} | cut -d= -f2-)" BGSAVE 2>/dev/null
    sleep 2
    docker cp ai-redis:/data/dump.rdb "${BK}/redis.rdb" 2>/dev/null || true

    for vol in omniroute_data cliproxyapi_data; do
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

    for vol in omniroute_data cliproxyapi_data; do
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
    [[ -z "${svc}" ]] && { echo "Usage: ./manage.sh shell <omniroute|cliproxyapi|postgres|redis>"; return 1; }
    dc exec "${svc}" sh -c 'command -v bash >/dev/null && bash || sh'
}

cmd_ssl_renew() { certbot renew --force-renewal --post-hook "systemctl reload nginx"; }
cmd_cleanup()   { docker image prune -f; docker volume prune -f; docker builder prune -f; find "${SCRIPT_DIR}" -name "*.log" -mtime +30 -delete 2>/dev/null; }

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
    *)          cmd_help ;;
esac
