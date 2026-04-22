# Production Deployment Guide

## Overview

This guide walks you through deploying the account pooling features to production.

**Time required:** 30-60 minutes

---

## Prerequisites

- [ ] OmniRoute running in production
- [ ] Redis accessible (docker-compose.unified.yml includes it)
- [ ] Domain configured with SSL
- [ ] At least 10-20 backend accounts per provider

---

## Step 1: Install Dependencies

```bash
cd OmniRoute
npm install
```

This installs `socks-proxy-agent@^8.0.2` required for proxy support.

---

## Step 2: Configure Environment

### Option A: Update Existing .env

Add to `OmniRoute/.env`:

```bash
# ═══════════════════════════════════════════════════════════════════════════════
# ACCOUNT POOLING & ANTI-DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

# Enable features
ENABLE_SESSION_PERSISTENCE=true
ENABLE_FINGERPRINT_RANDOMIZATION=true
ENABLE_ACCOUNT_POOLING=true

# Proxy (optional but recommended for production)
# Sign up at: Bright Data, Smartproxy, or Oxylabs
ROTATING_PROXY_URL=socks5://username:password@proxy.example.com:1080

# Limits (adjust based on provider limits)
DEFAULT_MAX_TOKENS_PER_HOUR=100000
DEFAULT_MAX_REQUESTS_PER_MINUTE=60
ACCOUNT_COOLDOWN_SECONDS=60
ACCOUNT_ERROR_THRESHOLD=5

# Jitter (human-like delays)
JITTER_MIN_MS=100
JITTER_MAX_MS=500
```

### Option B: Use Template

```bash
cp .env.pooling.example .env.pooling
nano .env.pooling
# Edit values, then merge into .env
```

---

## Step 3: Update Docker Compose

Edit `docker-compose.unified.yml`:

```yaml
services:
  omniroute:
    environment:
      # ... existing vars ...
      
      # Account Pooling
      ENABLE_SESSION_PERSISTENCE: "true"
      ENABLE_FINGERPRINT_RANDOMIZATION: "true"
      ENABLE_ACCOUNT_POOLING: "true"
      
      # Proxy (optional)
      ROTATING_PROXY_URL: "socks5://user:pass@proxy.example.com:1080"
      
      # Limits
      DEFAULT_MAX_TOKENS_PER_HOUR: "100000"
      DEFAULT_MAX_REQUESTS_PER_MINUTE: "60"
      ACCOUNT_COOLDOWN_SECONDS: "60"
```

---

## Step 4: Test Locally (Optional)

Before deploying to production, test locally:

```bash
# Start services
docker-compose -f docker-compose.unified.yml up -d

# Run test script
node test-pooling.mjs

# Send test request
curl -X POST http://localhost:20128/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "x-session-id: test-session-1" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Check Redis
docker exec -it ai-redis redis-cli -a YOUR_PASSWORD keys "session:*"
```

---

## Step 5: Deploy to Production

### Rebuild and Restart

```bash
# Stop services
docker-compose -f docker-compose.unified.yml down

# Rebuild with new code
docker-compose -f docker-compose.unified.yml build omniroute

# Start services
docker-compose -f docker-compose.unified.yml up -d

# Check logs
docker logs -f omniroute
```

### Verify Deployment

```bash
# Check OmniRoute is running
curl https://yourdomain.com/api/monitoring/health

# Check Redis is accessible
docker exec -it ai-redis redis-cli -a YOUR_PASSWORD ping
# Should return: PONG
```

---

## Step 6: Configure Proxy (Optional)

### Recommended Providers

1. **Bright Data** (https://brightdata.com)
   - Residential IPs
   - $500/mo for 40GB
   - Best for OAuth accounts

2. **Smartproxy** (https://smartproxy.com)
   - Residential + datacenter mix
   - $75/mo for 8GB
   - Good balance

3. **Oxylabs** (https://oxylabs.io)
   - Enterprise-grade
   - Custom pricing
   - Best for large scale

### Setup

1. Sign up for proxy service
2. Get SOCKS5 credentials
3. Add to `.env`:
   ```bash
   ROTATING_PROXY_URL=socks5://user:pass@proxy.example.com:1080
   ```
4. Restart OmniRoute

### Test Proxy

```bash
# Test proxy connectivity
curl --socks5 proxy.example.com:1080 https://api.ipify.org

# Should return proxy IP, not your server IP
```

---

## Step 7: Add Backend Accounts

### Via Dashboard

1. Go to `https://admin.yourdomain.com/dashboard/providers`
2. Add accounts for each provider
3. Accounts are automatically added to the pool

### Via API (Programmatic)

```bash
# Add account to pool
curl -X POST http://localhost:20128/api/account-pool/add \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "conn-abc123",
    "providerId": "openai",
    "maxTokensPerHour": 100000,
    "maxRequestsPerMinute": 60
  }'
```

---

## Step 8: Monitor Deployment

### Check Logs

```bash
# Watch for session creation
docker logs -f omniroute | grep "SessionPersistence"

# Watch for 429 errors
docker logs -f omniroute | grep "429 detected"

# Watch for cooldowns
docker logs -f omniroute | grep "in cooldown"
```

### Check Redis

```bash
# Active sessions
docker exec -it ai-redis redis-cli -a PASSWORD keys "session:*" | wc -l

# Cooldowns
docker exec -it ai-redis redis-cli -a PASSWORD keys "cooldown:*" | wc -l

# Token usage
docker exec -it ai-redis redis-cli -a PASSWORD keys "tokens:*" | wc -l
```

### Check Metrics API

```bash
curl https://yourdomain.com/api/account-pool/metrics \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

---

## Step 9: Add Dashboard Component (Optional)

Edit `OmniRoute/src/app/(dashboard)/dashboard/accounts/page.tsx`:

```typescript
import { AccountPoolManager } from "@/shared/components/AccountPoolManager";

export default function AccountsPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Account Management</h1>
      <AccountPoolManager />
    </div>
  );
}
```

Rebuild and restart:

```bash
docker-compose -f docker-compose.unified.yml build omniroute
docker-compose -f docker-compose.unified.yml up -d omniroute
```

Access at: `https://admin.yourdomain.com/dashboard/accounts`

---

## Step 10: Test End-to-End

### Test Session Persistence

```bash
# First message
curl -X POST https://yourdomain.com/v1/chat/completions \
  -H "Authorization: Bearer sk-test" \
  -H "x-session-id: e2e-test-1" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "My name is Alice"}]
  }'

# Second message (should remember context)
curl -X POST https://yourdomain.com/v1/chat/completions \
  -H "Authorization: Bearer sk-test" \
  -H "x-session-id: e2e-test-1" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "What is my name?"}]
  }'

# Should respond with "Alice"
```

### Test 429 Handling

```bash
# Trigger high load
for i in {1..100}; do
  curl -X POST https://yourdomain.com/v1/chat/completions \
    -H "Authorization: Bearer sk-test" \
    -H "x-session-id: load-test-$i" \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}]}' &
done

# Check logs for reassignments
docker logs omniroute | grep "Reassigned session"
```

---

## Troubleshooting

### Sessions Not Persisting

**Symptom:** Conversations break between requests

**Check:**
```bash
# Verify Redis is running
docker ps | grep redis

# Check Redis connectivity
docker exec -it ai-redis redis-cli -a PASSWORD ping

# Check if sessions are being created
docker exec -it ai-redis redis-cli -a PASSWORD keys "session:*"
```

**Fix:**
- Ensure Redis is running
- Check REDIS_PASSWORD in .env
- Verify ENABLE_SESSION_PERSISTENCE=true

---

### Accounts Still Getting Banned

**Symptom:** Accounts banned despite anti-detection

**Check:**
```bash
# Verify proxy is working
curl --socks5 proxy.example.com:1080 https://api.ipify.org

# Check if fingerprints are randomized
docker logs omniroute | grep "User-Agent" | sort -u
```

**Fix:**
- Use residential proxies (not datacenter)
- Increase jitter: JITTER_MAX_MS=1000
- Reduce request rate per account

---

### High Error Rates

**Symptom:** Many 429 errors

**Check:**
```bash
# Get account metrics
curl http://localhost:20128/api/account-pool/metrics

# Check error counts
docker exec -it ai-redis redis-cli -a PASSWORD keys "errors:*"
```

**Fix:**
- Add more backend accounts
- Reduce DEFAULT_MAX_TOKENS_PER_HOUR
- Increase ACCOUNT_COOLDOWN_SECONDS

---

## Scaling Guide

### 100 Users
- **Accounts:** 10-20 per provider
- **Redis:** 256MB
- **Proxy:** Optional (use server IP)
- **Cost:** ~$50/mo

### 500 Users
- **Accounts:** 50-100 per provider
- **Redis:** 1GB
- **Proxy:** Residential (40GB/mo)
- **Cost:** ~$500/mo

### 1000+ Users
- **Accounts:** 200+ per provider
- **Redis:** 4GB+
- **Proxy:** Dedicated pool (100GB/mo)
- **Cost:** ~$2000/mo

---

## Monitoring Checklist

- [ ] Session creation rate
- [ ] Session reassignment rate
- [ ] Account cooldown frequency
- [ ] Token usage per account
- [ ] Error rates (4xx/5xx)
- [ ] Proxy latency
- [ ] Redis memory usage

---

## Maintenance

### Daily
- Check logs for errors
- Monitor Redis memory usage
- Check account metrics API

### Weekly
- Review account error counts
- Tune token limits if needed
- Add/remove accounts based on usage

### Monthly
- Review proxy costs
- Optimize account distribution
- Update User-Agent strings

---

## Rollback Plan

If issues occur, rollback:

```bash
# Stop services
docker-compose -f docker-compose.unified.yml down

# Remove pooling env vars from docker-compose.unified.yml

# Restart
docker-compose -f docker-compose.unified.yml up -d

# System will work as before (without pooling)
```

---

## Support

- **Documentation:** See README_POOLING.md
- **Issues:** GitHub Issues
- **Community:** Discord

---

## Summary

✅ **Deployment Complete!**

Your system now:
1. Persists conversations across account switches
2. Applies anti-detection measures
3. Tracks usage and rotates intelligently
4. Handles 429 errors automatically

**Monitor for 24 hours, then tune limits based on actual usage.**
