#!/bin/bash
# Diagnostic script to check OmniRoute instance state

echo "🔍 OmniRoute Instance Diagnostic"
echo "================================"
echo ""

echo "📦 Running Containers:"
docker ps --filter "name=omniroute" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "💾 Volumes:"
docker volume ls | grep omniroute
echo ""

echo "🔌 Port Bindings:"
echo "Expected single instance: 127.0.0.1:20128, 127.0.0.1:20129"
if command -v netstat >/dev/null 2>&1; then
    netstat -tlnp 2>/dev/null | grep -E ":(20128|20129|20130|20131)" || true
elif command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null | grep -E ":(20128|20129|20130|20131)" || true
fi
echo ""

echo "📊 Container Health:"
docker inspect omniroute 2>/dev/null | jq -r '.[0].State.Health.Status' 2>/dev/null || \
echo "Container not found or jq not installed"
echo ""

echo "🗄️  SQLite Database Location:"
docker exec omniroute sh -c 'ls -lh /app/data/*.sqlite' 2>/dev/null || \
echo "Cannot access database (container not running)"
echo ""

echo "⚠️  Issues Detected:"
DUAL_INSTANCES=$(docker ps --filter "name=omniroute-" --format "{{.Names}}" | grep -E "omniroute-[12]" | wc -l)
if [ "$DUAL_INSTANCES" -gt 0 ]; then
    echo "   ❌ Stale dual OmniRoute instances detected ($DUAL_INSTANCES)"
    echo "      This causes SQLite race conditions and state corruption"
else
    echo "   ✅ Single instance detected"
fi

if command -v netstat >/dev/null 2>&1; then
    PORTS_20130=$(netstat -tlnp 2>/dev/null | grep -c ":20130" || true)
elif command -v ss >/dev/null 2>&1; then
    PORTS_20130=$(ss -tlnp 2>/dev/null | grep -c ":20130" || true)
else
    PORTS_20130=0
fi

if [ "$PORTS_20130" -gt 0 ]; then
    echo "   ❌ Port 20130 is in use (indicates legacy dual instance setup)"
else
    echo "   ✅ No legacy dual instance ports detected"
fi

echo ""
echo "📝 Recommendation:"
if [ "$DUAL_INSTANCES" -gt 0 ]; then
    echo "   Run: ./revert-to-single-instance.sh"
else
    echo "   System appears to be running single instance"
fi
