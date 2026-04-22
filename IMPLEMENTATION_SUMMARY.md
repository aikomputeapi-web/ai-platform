# Account Pooling Implementation Summary

## What Was Built

Three critical features for operating a pooled LLM proxy at scale:

### 1. **Sticky Sessions** (Session Persistence)
- Maps user sessions to specific backend accounts
- Stores conversation history in Redis
- Auto-reassigns on 429 errors with history injection
- **Files:** `src/lib/sessionPersistence/index.ts`

### 2. **Anti-Detection Layer**
- IP rotation via SOCKS5 proxies
- Browser fingerprint randomization per account
- Human-like jitter (100-500ms delays)
- **Files:** `src/lib/antiDetect/index.ts`

### 3. **Smart Account Pool**
- Token-level throttling (not just request counts)
- Error-triggered rotation with cooldowns
- Real-time account health tracking
- **Files:** `src/lib/accountPool/index.ts`

---

## File Structure

```
OmniRoute/
├── src/
│   ├── lib/
│   │   ├── sessionPersistence/
│   │   │   └── index.ts              # Session mapping & reassignment
│   │   ├── antiDetect/
│   │   │   └── index.ts              # Fingerprinting & jitter
│   │   ├── accountPool/
│   │   │   └── index.ts              # Account selection & throttling
│   │   └── pooledRouting/
│   │       └── index.ts              # Integrated routing middleware
│   ├── middleware/
│   │   └── poolingMiddleware.ts      # Request/response wrapper
│   ├── shared/
│   │   └── components/
│   │       └── AccountPoolManager.tsx # Admin dashboard UI
│   └── app/
│       └── api/
│           └── account-pool/
│               ├── metrics/route.ts   # GET account metrics
│               ├── cooldown/route.ts  # POST cooldown account
│               └── reset-errors/route.ts # POST reset errors
├── docs/
│   └── ACCOUNT_POOLING.md            # Full documentation
├── .env.pooling.example              # Configuration template
├── QUICKSTART_POOLING.md             # Quick start guide
└── DEPENDENCIES.md                   # Required npm packages
```

---

## Key Features

### Session Persistence
```typescript
// Client sends header
x-session-id: conversation-123

// Server maps to backend account
session:hash → {
  backendAccountId: "conn-abc...",
  conversationHistory: [...],
  lastUsed: timestamp
}

// On 429 error → auto-reassign + inject history
```

### Anti-Detection
```typescript
// Per-account fingerprint
{
  userAgent: "Mozilla/5.0 (Windows NT 10.0; ...)",
  acceptLanguage: "en-US,en;q=0.9",
  proxyUrl: "socks5://proxy.example.com:1080"
}

// Random jitter: 100-500ms per response
await addJitter(100, 500);
```

### Account Pool
```typescript
// Track usage per account
{
  tokensUsedHour: 45000 / 100000,
  requestsUsedMinute: 12 / 60,
  errorCount: 0,
  inCooldown: false
}

// Auto-select healthy account
const accountId = await selectHealthyAccount("openai", excludeAccounts);
```

---

## Integration Points

### 1. Chat Completions Endpoint
**File:** `src/app/api/v1/chat/completions/route.ts`

Add before `handleChat()`:
```typescript
import { handlePooledRequest, handlePooledResponse } from "@/lib/pooledRouting";

const { accountId, headers, agent, history } = await handlePooledRequest(
  request,
  userApiKey,
  providerId
);
```

### 2. Provider Credentials
**File:** `src/sse/services/auth.ts`

Modify `getProviderCredentialsWithQuotaPreflight()` to:
- Check account cooldown status
- Apply fingerprinted headers
- Use proxy agent

### 3. Error Handling
**File:** `src/sse/handlers/chat.ts`

Add after response:
```typescript
if (response.status === 429) {
  await reassignSession(userApiKey, sessionId, newAccountId, "rate_limit_429");
}
```

---

## Configuration

### Environment Variables
```bash
# Enable features
ENABLE_SESSION_PERSISTENCE=true
ENABLE_FINGERPRINT_RANDOMIZATION=true
ENABLE_ACCOUNT_POOLING=true

# Proxy (optional)
ROTATING_PROXY_URL=socks5://user:pass@proxy.example.com:1080

# Limits
DEFAULT_MAX_TOKENS_PER_HOUR=100000
DEFAULT_MAX_REQUESTS_PER_MINUTE=60
ACCOUNT_COOLDOWN_SECONDS=60
```

### Redis Schema
```
session:{hash}              → Session mapping (TTL: 1h)
cooldown:{accountId}        → Cooldown flag (TTL: 60s)
pool:{providerId}           → Set of account IDs
pool:metrics:{accountId}    → Account metrics JSON
tokens:{accountId}          → Token usage counter (TTL: 1h)
pool:requests:{accountId}   → Request counter (TTL: 60s)
errors:{accountId}          → Error counter (TTL: 5m)
```

---

## Usage Example

### Client Request
```bash
curl https://yourdomain.com/v1/chat/completions \
  -H "Authorization: Bearer sk-your-key" \
  -H "x-session-id: conv-123" \
  -d '{"model":"gpt-4","messages":[...]}'
```

### Server Flow
1. Extract `x-session-id` header
2. Check Redis for existing session mapping
3. If not found: select healthy account from pool
4. Apply fingerprint (User-Agent, proxy)
5. Inject conversation history
6. Execute request with anti-detection headers
7. Track token usage
8. On 429: reassign to new account + inject history
9. Add jitter delay (100-500ms)

---

## Dashboard

### Account Pool Manager
Access at: `https://admin.yourdomain.com/dashboard/accounts`

Features:
- Real-time account metrics
- Token usage progress bars
- Error count tracking
- Manual cooldown controls
- Quarantine status indicators

---

## Testing

### 1. Session Persistence
```bash
# Send two messages with same session ID
curl -H "x-session-id: test-1" -d '{"messages":[{"role":"user","content":"My name is Alice"}]}'
curl -H "x-session-id: test-1" -d '{"messages":[{"role":"user","content":"What is my name?"}]}'
# Should remember "Alice"
```

### 2. Account Rotation
```bash
# Trigger 429 errors
for i in {1..100}; do curl -H "x-session-id: load-$i" ...; done
# Check logs for reassignment messages
```

### 3. Anti-Detection
```bash
# Verify different User-Agents per account
docker logs omniroute | grep "User-Agent" | sort -u
```

---

## Production Deployment

### Prerequisites
- Redis with persistence enabled
- Rotating residential proxy (Bright Data, Smartproxy)
- 10-20 backend accounts per provider minimum

### Scaling Guide
- **100 users:** 10-20 accounts, 256MB Redis, no proxy required
- **500 users:** 50-100 accounts, 1GB Redis, 40GB/mo proxy
- **1000+ users:** 200+ accounts, 4GB Redis, 100GB/mo proxy

---

## Monitoring

### Key Metrics
1. Session reassignments per hour
2. Account cooldowns per provider
3. Token usage per account
4. Error rates (4xx/5xx)
5. Proxy latency

### Logs to Watch
```bash
[SessionPersistence] Reassigned session-123: conn-abc → conn-xyz
[AccountPool] 429 detected on conn-abc, errors: 3
[AntiDetect] Applied fingerprint for conn-abc
```

---

## Security & Compliance

### Important Notes
1. **Rate Limit Evasion:** This system is for legitimate aggregation/failover, not abuse
2. **Provider ToS:** Ensure compliance with provider terms of service
3. **Data Privacy:** Conversation history stored in Redis (use encryption at rest)
4. **Proxy Security:** Use authenticated SOCKS5 proxies only

---

## Next Steps

1. **Install dependencies:** `npm install socks-proxy-agent`
2. **Configure environment:** Copy `.env.pooling.example` to `.env`
3. **Add accounts:** Use OmniRoute dashboard to add backend accounts
4. **Set up proxy:** Sign up for residential proxy service
5. **Test locally:** Follow QUICKSTART_POOLING.md
6. **Deploy:** Update docker-compose.unified.yml with new env vars
7. **Monitor:** Check `/api/account-pool/metrics` regularly

---

## Support & Documentation

- **Full Docs:** `docs/ACCOUNT_POOLING.md`
- **Quick Start:** `QUICKSTART_POOLING.md`
- **Dependencies:** `DEPENDENCIES.md`
- **Issues:** GitHub Issues
- **Community:** Discord

---

## Implementation Status

✅ **Core Modules**
- Session persistence with Redis
- Anti-detection fingerprinting
- Account pool management
- Integrated routing middleware

✅ **API Routes**
- GET /api/account-pool/metrics
- POST /api/account-pool/cooldown
- POST /api/account-pool/reset-errors

✅ **Dashboard UI**
- AccountPoolManager component
- Real-time metrics display
- Manual controls

✅ **Documentation**
- Full technical documentation
- Quick start guide
- Configuration examples

⚠️ **Integration Required**
- Modify chat.ts to use pooled routing
- Update auth.ts to check cooldowns
- Add fingerprinting to provider requests
- Wire up dashboard component

---

## Estimated Integration Time

- **Core integration:** 2-4 hours
- **Testing:** 1-2 hours
- **Dashboard setup:** 1 hour
- **Production deployment:** 2-3 hours

**Total:** 6-10 hours for full implementation
