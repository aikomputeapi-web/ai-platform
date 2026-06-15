#!/bin/bash
# Revert to single OmniRoute instance and clean up state

set -e

echo "🔄 Reverting to single OmniRoute instance..."

# Stop all containers
echo "⏹️  Stopping containers..."
docker compose -f docker-compose.unified.yml down

# Remove the old dual instances if they exist
echo "🗑️  Removing old dual-instance containers..."
docker rm -f omniroute-1 omniroute-2 customer-portal-1 customer-portal-2 2>/dev/null || true

# Clean up the OmniRoute data volume to reset state
# WARNING: This will delete all provider connections, API keys, and settings!
# Comment out the next line if you want to preserve your data
echo "⚠️  Cleaning OmniRoute data volume (this will reset all provider connections)..."
docker volume rm ai-omniroute-data 2>/dev/null || true

# Restart with single instance
echo "🚀 Starting single instance..."
docker compose -f docker-compose.unified.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

# Show status
echo ""
echo "✅ Single instance deployment complete!"
echo ""
echo "Services:"
docker compose -f docker-compose.unified.yml ps
echo ""
echo "📊 Check logs with:"
echo "   docker compose -f docker-compose.unified.yml logs -f omniroute"
echo ""
echo "🌐 Access points:"
echo "   Admin Dashboard: https://admin.${DOMAIN:-localhost}"
echo "   Customer Portal: https://${DOMAIN:-localhost}"
echo "   API Endpoint: https://${DOMAIN:-localhost}/v1"
