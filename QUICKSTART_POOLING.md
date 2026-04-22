# Quick Start: Account Pooling & Anti-Detection

## Installation

### 1. Install Dependencies

```bash
cd OmniRoute
npm install socks-proxy-agent@^8.0.2
```

### 2. Configure Environment

```bash
cp .env.pooling.example .env.pooling
nano .env.pooling
```

Add to your main `.env`:
```bash
# Account Pooling
ENABLE_SESSION_PERSISTENCE=true
ENABLE_FINGERPRINT_RANDOMIZATION=true
ENABLE_ACCOUNT_POOLING=true

# Proxy (optional but recommended for production)
ROTATING_PROXY_URL=socks5://user:pass@proxy.example.com:1080

# Limits
DEFAULT_MAX_TOKENS_PER_HOUR=100000
DEFAULT_MAX_REQUESTS_PER_MINUTE=60
ACCOUNT_COOLDOWN_SECONDS=60
```

### 3. Verify Redis

```bash
docker exec -it ai-redis redis-cli -a YOUR_PASSWORD ping
# Should return: PONG
```

---

## Usage

### Client-Side: Send Session Header

```bash
curl https://yourdomain.com/v1/chat/completions \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "x-session-id: conversation-abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello, remember this conversation"}
    ]
  }'
```

**Without session header:** Each request may use a different backend account (conversation breaks).

**With session header:** All requests in the same session use the same backend account (conversation persists).

---

## Testing

### 1. Test Session Persistence

```bash
# First message
curl -X POST https://yourdomain.com/v1/chat/completions \
  -H "Authorization: Bearer sk-test" \
  -H "x-session-id: test-session-1" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"My name is Alice"}]}'

# Second message (should remember context)
curl -X POST https://yourdomain.com/v1/chat/completions \
  -H "Authorization: Bearer sk-test" \
  -H "x-session-id: test-session-1" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"What is my name?"}]}'
```

### 2. Test Account Rotation on 429

```bash
# Simulate high load to trigger 429
for i in {1..100}; do
  curl -X POST https://yourdomain.com/v1/chat/completions \
    -H "Authorization: Bearer sk-test" \
    -H "x-session-id: load-test-$i" \
    -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}]}' &
done
```

Check logs:
```bash
docker logs omniroute | grep "429 detected"
# Should see: [AccountPool] 429 detected on conn-abc..., errors: 3
# Should see: [SessionPersistence] Reassigned session-123: conn-abc → conn-xyz
```

### 3. Test Anti-Detection

```bash
# Check if fingerprints are randomized
docker logs omniroute | grep "User-Agent"
# Should see different User-Agents per account
```

---

## Dashboard

### Add Account Pool Manager to Dashboard

Edit `OmniRoute/src/app/(dashboard)/dashboard/accounts/page.tsx`:

```typescript
import { AccountPoolManager } from "@/shared/components/AccountPoolManager";

export default function AccountsPage() {
  return (
    <div>
      <h1>Account Management</h1>
      <AccountPoolManager />
    </div>
  );
}
```

Access at: `https://admin.yourdomain.com/dashboard/accounts`

---

## Monitoring

### Check Redis Keys

```bash
# Session mappings
docker exec -it ai-redis redis-cli -a YOUR_PASSWORD keys "session:*"

# Account cooldowns
docker exec -it ai-redis redis-cli -a YOUR_PASSWORD keys "cooldown:*"

# Token usage
docker exec -it ai-redis redis-cli -a YOUR_PASSWORD keys "tokens:*"
```

### View Account Metrics

```bash
curl http://localhost:20128/api/account-pool/metrics \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

---

## Production Checklist

- [ ] Redis configured with persistence (`appendonly yes`)
- [ ] Rotating proxy configured (residential IPs recommended)
- [ ] Account limits set conservatively (80% of provider limits)
- [ ] Monitoring dashboard accessible
- [ ] Session TTL configured (default: 1 hour)
- [ ] Error thresholds tuned (default: 5 errors before quarantine)
- [ ] Jitter enabled (100-500ms)
- [ ] Logs monitored for 429 errors

---

## Troubleshooting

### Sessions not persisting
```bash
# Check Redis connection
docker exec -it ai-redis redis-cli -a YOUR_PASSWORD ping

# Check if sessions are being created
docker exec -it ai-redis redis-cli -a YOUR_PASSWORD keys "session:*"
```

### Accounts still getting banned
```bash
# Verify proxy is working
curl --socks5 proxy.example.com:1080 https://api.ipify.org

# Check if fingerprints are randomized
docker logs omniroute | grep "User-Agent" | sort -u
```

### High error rates
```bash
# Check account metrics
curl http://localhost:20128/api/account-pool/metrics

# Manually cooldown problematic account
curl -X POST http://localhost:20128/api/account-pool/cooldown \
  -H "Content-Type: application/json" \
  -d '{"accountId":"conn-abc123","seconds":300}'
```

---

## Next Steps

1. **Add more accounts:** Go to OmniRoute dashboard → Providers → Add accounts
2. **Configure proxy:** Sign up for Bright Data or Smartproxy
3. **Monitor metrics:** Check `/api/account-pool/metrics` regularly
4. **Tune limits:** Adjust `DEFAULT_MAX_TOKENS_PER_HOUR` based on usage
5. **Scale up:** Add more backend accounts as user base grows

---

## Support

- Documentation: `docs/ACCOUNT_POOLING.md`
- Issues: GitHub Issues
- Community: Discord
