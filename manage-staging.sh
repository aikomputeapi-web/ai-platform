#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Staging Management Script
# ══════════════════════════════════════════════════════════════════════════════
#
#  Usage: ./manage-staging.sh <command>
#
#  Commands:
#    status      Health dashboard (staging)
#    logs        Tail all staging logs
#    logs <svc>  Tail one service (omniroute, postgres, redis, customer-portal)
#    restart     Restart all staging services
#    restart <s> Restart one staging service
#    stop / start / rebuild
#    backup      Full staging backup (DB + volumes)
#    health      HTTP endpoint checks (staging ports)
#    shell <svc> Shell into staging container
#    cleanup     Prune old images/logs
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.unified.yml"
STAGING_FILE="${SCRIPT_DIR}/docker-compose.staging.yml"
ENV_FILE="${SCRIPT_DIR}/.env.staging"
BACKUP_DIR="${SCRIPT_DIR}/backups/staging"
PROJECT="aikompute-staging"

dc() { docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" -f "${STAGING_FILE}" -p "${PROJECT}" "$@"; }

cmd_status() {
    echo ""
    echo -e "${CYAN}${BOLD}═══ Staging Service Status ═══${NC}"
    echo ""
    dc ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""

    echo -e "${BOLD}Health:${NC}"
    for svc in "OmniRoute Dashboard:22028/" "OmniRoute API:22029/v1/models" "Customer Portal:3301/api/health"; do
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

    dc exec -T postgres pg_isready -U aiplatform &>/dev/null && \
        echo -e "  ${GREEN}●${NC} PostgreSQL — ${GREEN}Ready${NC}" || \
        echo -e "  ${RED}●${NC} PostgreSQL — ${RED}Down${NC}"

    dc exec -T redis redis-cli -a "$(grep REDIS_PASSWORD "${ENV_FILE}" 2>/dev/null | cut -d= -f2-)" ping 2>/dev/null | grep -q PONG && \
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

cmd_backup() {
    local TS=$(date +%Y%m%d_%H%M%S)
    local BK="${BACKUP_DIR}/${TS}"
    mkdir -p "${BK}"

    cp "${ENV_FILE}" "${BK}/.env.staging"

    dc exec -T postgres pg_dump -U aiplatform aiplatform > "${BK}/postgres.sql" 2>/dev/null || true

    dc exec -T redis redis-cli -a "$(grep REDIS_PASSWORD "${ENV_FILE}" | cut -d= -f2-)" BGSAVE 2>/dev/null
    sleep 2
    docker cp staging-redis:/data/dump.rdb "${BK}/redis.rdb" 2>/dev/null || true

    for vol in staging_omniroute_data; do
        # Map staging_*_data → ai-*-data-staging (replace underscores appropriately)
        local base="${vol#staging_}"
        base="${base%_data}"
        local vol_name="ai-${base}-data-staging"
        docker run --rm -v "${vol_name}:/src:ro" -v "${BK}:/bk" alpine tar cf "/bk/${vol}.tar" -C /src . 2>/dev/null || warn "Volume backup failed for ${vol_name}"
    done

    tar czf "${BACKUP_DIR}/staging_backup_${TS}.tar.gz" -C "${BACKUP_DIR}" "${TS}"
    rm -rf "${BK}"

    echo -e "${GREEN}[✓]${NC} Staging backup: ${BACKUP_DIR}/staging_backup_${TS}.tar.gz ($(du -sh "${BACKUP_DIR}/staging_backup_${TS}.tar.gz" | cut -f1))"

    # Keep last 5 staging backups
    ls -t "${BACKUP_DIR}"/staging_backup_*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
}

cmd_health() {
    echo ""
    echo -e "${BOLD}Staging Health Checks:${NC}"
    for ep in "Dashboard|http://127.0.0.1:22028/" "API|http://127.0.0.1:22029/v1/models" "Portal|http://127.0.0.1:3301/api/health"; do
        local n="${ep%%|*}" u="${ep##*|}"
        local s=$(date +%s%N)
        local c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${u}" 2>/dev/null || echo "000")
        local ms=$(( ($(date +%s%N) - s) / 1000000 ))
        [[ "${c}" =~ ^(200|302|307|308|401)$ ]] && echo -e "  ${GREEN}●${NC} ${n}: ${c} (${ms}ms)" || echo -e "  ${RED}●${NC} ${n}: ${c}"
    done
    echo ""
}

cmd_shell() {
    local svc="${1:-}"
    [[ -z "${svc}" ]] && { echo "Usage: ./manage-staging.sh shell <omniroute|postgres|redis|customer-portal>"; return 1; }
    dc exec "${svc}" sh -c 'command -v bash >/dev/null && bash || sh'
}

cmd_cleanup() { docker image prune -f; }

cmd_help() {
    echo -e "\n${BOLD}AI Platform — Staging Management${NC}\n"
    echo "  status          Staging service health + resources"
    echo "  start/stop      Start or stop staging"
    echo "  restart [svc]   Restart all or one staging service"
    echo "  rebuild         Full staging rebuild"
    echo "  logs [svc]      Tail staging logs"
    echo "  health          HTTP health checks (staging ports)"
    echo "  shell <svc>     Enter staging container"
    echo "  backup          Full staging backup"
    echo "  cleanup         Prune old images"
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
    health)     cmd_health ;;
    shell)      shift; cmd_shell "$@" ;;
    cleanup)    cmd_cleanup ;;
    *)          cmd_help ;;
esac
