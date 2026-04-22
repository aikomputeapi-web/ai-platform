# Account Pooling Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT REQUEST                                 │
│                                                                             │
│  curl -H "x-session-id: conv-123" \                                        │
│       -H "Authorization: Bearer sk-user-key" \                             │
│       https://yourdomain.com/v1/chat/completions                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OMNIROUTE MIDDLEWARE                                │
│                     (src/sse/handlers/chat.ts)                              │
│                                                                             │
│  1. Extract x-session-id header                                            │
│  2. Extract API key from Authorization header                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SESSION PERSISTENCE LAYER                              │
│                  (src/lib/sessionPersistence/index.ts)                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ Redis: session:{hash}                                        │          │
│  │ {                                                            │          │
│  │   userApiKey: "sk-user-key",                                │          │
│  │   sessionId: "conv-123",                                    │          │
│  │   backendAccountId: "conn-abc123",                          │          │
│  │   providerId: "openai",                                     │          │
│  │   conversationHistory: [...],                               │          │
│  │   lastUsed: 1234567890                                      │          │
│  │ }                                                            │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  ✓ Session found? → Use existing account                                   │
│  ✗ Session not found? → Select new account from pool                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ACCOUNT POOL MANAGER                                │
│                    (src/lib/accountPool/index.ts)                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ Redis: pool:openai                                           │          │
│  │ Set: [conn-abc123, conn-def456, conn-ghi789]               │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  For each account, check:                                                   │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ ✓ Not in cooldown? (cooldown:{accountId})                  │          │
│  │ ✓ Token usage < limit? (tokens:{accountId})                │          │
│  │ ✓ Request rate < limit? (pool:requests:{accountId})        │          │
│  │ ✓ Error count < threshold? (errors:{accountId})            │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  → Select healthiest account                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ANTI-DETECTION LAYER                                  │
│                    (src/lib/antiDetect/index.ts)                            │
│                                                                             │
│  Apply per-account fingerprint:                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ User-Agent: Mozilla/5.0 (Windows NT 10.0; ...)             │          │
│  │ Accept-Language: en-US,en;q=0.9                            │          │
│  │ Sec-Ch-Ua: "Not_A Brand";v="8", "Chromium";v="120"        │          │
│  │ Proxy: socks5://proxy.example.com:1080                     │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  → Randomized per account (cached)                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CONVERSATION HISTORY INJECTION                         │
│                  (src/lib/pooledRouting/index.ts)                           │
│                                                                             │
│  Original request:                                                          │
│  {                                                                          │
│    "messages": [                                                            │
│      {"role": "user", "content": "What's my name?"}                        │
│    ]                                                                        │
│  }                                                                          │
│                                                                             │
│  Enriched request (with history):                                           │
│  {                                                                          │
│    "messages": [                                                            │
│      {"role": "user", "content": "My name is Alice"},      ← From history  │
│      {"role": "assistant", "content": "Hi Alice!"},        ← From history  │
│      {"role": "user", "content": "What's my name?"}        ← New message   │
│    ]                                                                        │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROVIDER API CALL                                   │
│                   (src/sse/services/auth.ts)                                │
│                                                                             │
│  fetch("https://api.openai.com/v1/chat/completions", {                     │
│    method: "POST",                                                          │
│    headers: {                                                               │
│      "Authorization": "Bearer sk-backend-account-key",                      │
│      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; ...)",  ← Fingerprinted  │
│      "Accept-Language": "en-US,en;q=0.9",                 ← Fingerprinted  │
│      ...                                                                    │
│    },                                                                       │
│    body: JSON.stringify(enrichedRequest),                                  │
│    agent: socksProxyAgent                                  ← IP rotation   │
│  })                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RESPONSE HANDLING                                   │
│                   (src/sse/handlers/chat.ts)                                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ Success (200)?                                               │          │
│  │ ✓ Track token usage: tokens:{accountId} += total_tokens    │          │
│  │ ✓ Track request: pool:requests:{accountId} += 1            │          │
│  │ ✓ Reset error count: errors:{accountId} = 0                │          │
│  │ ✓ Update session history                                    │          │
│  │ ✓ Add jitter delay (100-500ms)                             │          │
│  └─────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐          │
│  │ Rate Limited (429)?                                          │          │
│  │ ✓ Increment error count: errors:{accountId} += 1           │          │
│  │ ✓ Set cooldown: cooldown:{accountId} = 1 (TTL: 60s)       │          │
│  │ ✓ Select new healthy account from pool                      │          │
│  │ ✓ Reassign session: session:{hash}.backendAccountId = new  │          │
│  │ ✓ Retry request with conversation history                   │          │
│  └─────────────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RETURN TO CLIENT                                    │
│                                                                             │
│  HTTP 200 OK                                                                │
│  {                                                                          │
│    "choices": [{                                                            │
│      "message": {                                                           │
│        "role": "assistant",                                                 │
│        "content": "Your name is Alice!"                                     │
│      }                                                                      │
│    }],                                                                      │
│    "usage": {                                                               │
│      "total_tokens": 150                                                    │
│    }                                                                        │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Redis Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              REDIS KEYS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  session:{hash}                    → Session mapping (TTL: 1h)             │
│  ├─ userApiKey                                                              │
│  ├─ sessionId                                                               │
│  ├─ backendAccountId                                                        │
│  ├─ providerId                                                              │
│  ├─ conversationHistory[]                                                   │
│  └─ lastUsed                                                                │
│                                                                             │
│  cooldown:{accountId}              → Cooldown flag (TTL: 60s)              │
│  └─ "1"                                                                     │
│                                                                             │
│  pool:{providerId}                 → Set of account IDs                    │
│  └─ [conn-abc123, conn-def456, ...]                                        │
│                                                                             │
│  pool:metrics:{accountId}          → Account metrics JSON                  │
│  ├─ tokensUsedHour                                                          │
│  ├─ requestsUsedMinute                                                      │
│  ├─ errorCount                                                              │
│  ├─ maxTokensPerHour                                                        │
│  └─ maxRequestsPerMinute                                                    │
│                                                                             │
│  tokens:{accountId}                → Token usage counter (TTL: 1h)         │
│  └─ "45000"                                                                 │
│                                                                             │
│  pool:requests:{accountId}         → Request counter (TTL: 60s)            │
│  └─ "12"                                                                    │
│                                                                             │
│  errors:{accountId}                → Error counter (TTL: 5m)               │
│  └─ "3"                                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         429 ERROR DETECTED                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. Increment error count                                                   │
│     errors:{accountId} += 1                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. Set cooldown flag                                                       │
│     cooldown:{accountId} = "1" (TTL: 60s)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. Select new healthy account                                              │
│     - Exclude accounts in cooldown                                          │
│     - Exclude accounts with high error count                                │
│     - Exclude accounts near token limit                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. Reassign session                                                        │
│     session:{hash}.backendAccountId = newAccountId                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. Inject conversation history                                             │
│     Prepend previous messages to new request                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  6. Retry request                                                           │
│     Use new account with full conversation context                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  7. Success!                                                                │
│     User never noticed the account switch                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Interaction

```
┌──────────────────┐
│  Client Request  │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                    chat.ts (Handler)                         │
│  - Extract session ID                                        │
│  - Extract API key                                           │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│              sessionPersistence/index.ts                     │
│  - getSessionMapping()                                       │
│  - setSessionMapping()                                       │
│  - reassignSession()                                         │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                accountPool/index.ts                          │
│  - selectHealthyAccount()                                    │
│  - trackTokenUsage()                                         │
│  - trackRequestUsage()                                       │
│  - incrementErrorCount()                                     │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                 antiDetect/index.ts                          │
│  - getOrCreateFingerprint()                                  │
│  - applyFingerprint()                                        │
│  - getProxyAgent()                                           │
│  - addJitter()                                               │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                 pooledRouting/index.ts                       │
│  - handlePooledRequest()                                     │
│  - handlePooledResponse()                                    │
│  - injectConversationHistory()                               │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                   auth.ts (Credentials)                      │
│  - getProviderCredentials()                                  │
│  - Check cooldown status                                     │
│  - Apply fingerprinted headers                               │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                   Provider API Call                          │
│  - With fingerprinted headers                                │
│  - Through SOCKS5 proxy                                      │
│  - With conversation history                                 │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                   Response Handling                          │
│  - Track usage                                               │
│  - Handle errors                                             │
│  - Add jitter                                                │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  Client Response │
└──────────────────┘
```
