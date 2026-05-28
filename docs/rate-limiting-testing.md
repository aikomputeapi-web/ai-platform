# Rate Limiting Testing Guide

## Overview

This guide describes how to test the Pro and Pro Max subscription rate limiting system at unit, integration, manual, load, and production-monitoring levels. The key implementation under test is [`UserRateLimitManager`](../OmniRoute/open-sse/services/userRateLimitManager.ts), with request-flow integration in [`chatCore.ts`](../OmniRoute/open-sse/handlers/chatCore.ts).

## Test Environment

Use an isolated staging or local environment with disposable PostgreSQL and Redis instances.

Required environment variables:

```bash
PORTAL_DATABASE_URL=postgresql://customer_portal_user:change_me@localhost:5432/customer_portal_test
REDIS_URL=redis://localhost:6379/15
USER_RATE_LIMIT_ENABLED=true
USER_RATE_LIMIT_FAIL_OPEN=false
```

Recommended setup:

```bash
cd /home/stevenleblanc62920/ai-platform/customer-portal
DATABASE_URL="$PORTAL_DATABASE_URL" npx prisma migrate deploy
DATABASE_URL="$PORTAL_DATABASE_URL" npm run db:seed

cd /home/stevenleblanc62920/ai-platform/OmniRoute
npm install
npm run test:unit
```

Clear Redis before each test run:

```bash
redis-cli -u "$REDIS_URL" FLUSHDB
```

## Unit Testing

Unit tests should isolate [`UserRateLimitManager`](../OmniRoute/open-sse/services/userRateLimitManager.ts) from real providers. Use a test Redis database or a Redis-compatible mock that supports `EVAL`, sorted sets, `GET`, `SET`, `INCR`, and `EXPIRE`.

### Suggested Unit Test Cases

| Case | Expected result |
|---|---|
| Pro plan under minute limit | `allowed: true`, quota remaining decreases by one. |
| Pro Max plan under minute limit | `allowed: true`, higher limits are used. |
| Minute quota exhausted | `allowed: false`, `reason: rate_limit_minute`, `retryAfter` is positive. |
| Day quota exhausted | `allowed: false`, `reason: rate_limit_day`. |
| Month quota exhausted | `allowed: false`, `reason: rate_limit_month`. |
| Unknown plan with fallback enabled | Free fallback limits are used. |
| Unknown plan with reject behavior | Request is denied with `unknown_plan`. |
| Redis error with fail-open false | Request is denied with `dependency_unavailable`. |
| Redis error with fail-open true | Request is allowed with `dependency_unavailable` reason. |
| Disabled feature flag | Request is allowed without Redis quota reservation. |
| `getUserQuotaInfo` snapshot | Returns usage without incrementing quota. |
| `incrementUserUsage` | Increments `user-usage-success:{userId}:day:{yyyy-mm-dd}`. |

### Example Unit Test Skeleton

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "redis";
import { UserRateLimitManager } from "../open-sse/services/userRateLimitManager.ts";

test("allows a Pro user below quota", async () => {
  const redisClient = createClient({ url: process.env.REDIS_URL });
  await redisClient.connect();
  await redisClient.flushDb();

  const manager = new UserRateLimitManager({
    redisClient,
    portalDb: {
      getPlanLimits: async () => ({
        requestsPerMinute: 60,
        requestsPerDay: 10000,
        requestsPerMonth: 300000,
      }),
    },
    enabled: true,
    failOpen: false,
  });

  const result = await manager.checkUserRateLimit("test-user-1", "pro");

  assert.equal(result.allowed, true);
  assert.equal(result.quotaInfo.minute.limit, 60);
  assert.equal(result.quotaInfo.minute.used, 1);
  assert.equal(result.quotaInfo.minute.remaining, 59);

  await manager.close();
});
```

## Integration Testing

Integration tests should verify the full OmniRoute pipeline from API key authentication to provider execution gating.

### Integration Test Setup

1. Create a Customer Portal user with `plan_id = 'pro'`.
2. Create a `user_api_keys` row with `omniroute_key_id` matching a valid OmniRoute API key ID.
3. Start Redis and clear the test database.
4. Start OmniRoute with `USER_RATE_LIMIT_ENABLED=true`.
5. Use a test provider credential or provider stub to avoid production provider spend.

### Integration Test Scenarios

| Scenario | Expected result |
|---|---|
| Valid Pro key within quota | Request succeeds and includes Pro quota headers. |
| Valid Pro Max key within quota | Request succeeds and includes Pro Max quota headers. |
| Exhausted Pro minute quota | Request returns `429` before provider executor is called. |
| Exhausted day quota | Request returns `429` with day quota data. |
| Exhausted month quota | Request returns `429` with month quota data. |
| Missing Customer Portal mapping | Request returns `403 No active subscription plan found`. |
| Anthropic request | Quota is checked and decremented. |
| OpenAI request | Quota is checked and decremented. |
| Streaming request over quota | `429` JSON is returned before SSE stream starts. |
| Feature flag disabled | Request is not blocked by subscription quota. |
| Redis unavailable and fail-open false | Request is denied with dependency failure behavior. |
| Redis unavailable and fail-open true | Request proceeds and logs dependency failure. |

### Provider Call Guard

When testing quota rejection, assert that provider calls are not sent. In a stubbed executor, count invocations:

```text
Given user has exhausted quota
When request is sent
Then response status is 429
And provider executor invocation count remains 0
```

## Manual Testing with cURL

Replace these variables before running commands:

```bash
export OMNIROUTE_BASE_URL=https://omniroute.example.com
export PRO_API_KEY=replace-with-pro-key
export PRO_MAX_API_KEY=replace-with-pro-max-key
```

### Successful Pro Request

```bash
curl -i "$OMNIROUTE_BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $PRO_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"Say pro ok"}],
    "stream": false
  }'
```

Expected headers include:

```text
X-RateLimit-Limit-Minute: 60
X-RateLimit-Remaining-Minute: 59
X-RateLimit-Limit-Day: 10000
X-RateLimit-Limit-Month: 300000
```

### Successful Pro Max Request

```bash
curl -i "$OMNIROUTE_BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $PRO_MAX_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"Say pro max ok"}],
    "stream": false
  }'
```

Expected headers include:

```text
X-RateLimit-Limit-Minute: 300
X-RateLimit-Limit-Day: 100000
X-RateLimit-Limit-Month: 3000000
```

### Trigger Minute Limit

Use a loop against a staging key with intentionally low test limits, or temporarily lower the plan in a test database.

```bash
for i in $(seq 1 65); do
  curl -s -o /tmp/rl-body.txt -w "%{http_code} %{time_total}\n" \
    "$OMNIROUTE_BASE_URL/v1/chat/completions" \
    -H "Authorization: Bearer $PRO_API_KEY" \
    -H 'Content-Type: application/json' \
    -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}],"stream":false}'
done
```

Expected result after the minute limit is reached:

```text
HTTP/1.1 429 Too Many Requests
Retry-After: <positive integer>
X-RateLimit-Remaining-Minute: 0
```

### Verify Anthropic Requests Are Limited

```bash
curl -i "$OMNIROUTE_BASE_URL/v1/messages" \
  -H "Authorization: Bearer $PRO_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "claude-3-5-haiku-latest",
    "max_tokens": 16,
    "messages": [{"role":"user","content":"Say anthropic ok"}]
  }'
```

Check that the same `X-RateLimit-*` headers appear.

### Verify Feature Flag

1. Set `USER_RATE_LIMIT_ENABLED=false`.
2. Restart OmniRoute.
3. Send enough requests to exceed the normal test limit.
4. Confirm requests are not rejected by subscription quota.
5. Re-enable the flag after the test.

## Test Scenarios Checklist

### Minute, Day, and Month Limits

- [ ] Configure low limits in a test plan.
- [ ] Send requests until minute quota is exhausted.
- [ ] Verify `rate_limit_minute` behavior.
- [ ] Preload or generate daily quota usage.
- [ ] Verify `rate_limit_day` behavior.
- [ ] Preload or generate monthly quota usage.
- [ ] Verify `rate_limit_month` behavior.

### 429 Responses and Headers

- [ ] Response status is `429`.
- [ ] `Retry-After` is present.
- [ ] `Content-Type` is `application/json`.
- [ ] Response body contains `error.type` and `error.code`.
- [ ] Response body contains quota details.
- [ ] Provider executor is not called.

### Successful Request Quota Headers

- [ ] `X-RateLimit-Limit-Minute` is present.
- [ ] `X-RateLimit-Remaining-Minute` decreases after each request.
- [ ] `X-RateLimit-Limit-Day` is present.
- [ ] `X-RateLimit-Remaining-Day` decreases after each request.
- [ ] `X-RateLimit-Limit-Month` is present.
- [ ] `X-RateLimit-Remaining-Month` decreases after each request.

### Anthropic and OpenAI Coverage

- [ ] OpenAI-compatible chat completion decrements quota.
- [ ] Anthropic-compatible messages request decrements quota.
- [ ] Streaming request decrements quota once.
- [ ] Unsupported or unrelated provider paths do not unexpectedly consume subscription quota.

### Feature Flag

- [ ] `USER_RATE_LIMIT_ENABLED=true` enforces limits.
- [ ] `USER_RATE_LIMIT_ENABLED=false` bypasses enforcement.
- [ ] `USER_RATE_LIMIT_FAIL_OPEN=false` denies on dependency failure.
- [ ] `USER_RATE_LIMIT_FAIL_OPEN=true` allows during dependency failure.

## Load Testing

Load testing should focus on Redis atomicity, request latency, and provider protection.

### Recommendations

- Use staging provider credentials or a stubbed provider endpoint.
- Use a dedicated Redis database.
- Test one hot user ID to validate concurrency safety.
- Test many user IDs to validate aggregate Redis throughput.
- Keep provider calls stubbed when testing high request volume.
- Monitor Redis CPU, memory, command latency, and rejected quota counts.

### Example Load Test Shape

```text
Test A: 100 concurrent requests for one Pro test user with minute limit 60
Expected: at most 60 allowed, remaining rejected with 429

Test B: 500 concurrent requests spread across 100 users
Expected: no cross-user quota leakage, Redis latency remains stable

Test C: sustained requests for one user over minute boundary
Expected: sliding minute window recovers as old scores expire
```

### Example with `autocannon`

```bash
npx autocannon -c 50 -d 30 \
  -H "Authorization=Bearer $PRO_API_KEY" \
  -H "Content-Type=application/json" \
  -m POST \
  -b '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"load test"}],"stream":false}' \
  "$OMNIROUTE_BASE_URL/v1/chat/completions"
```

## Monitoring During Tests

Watch these signals while running integration and load tests:

| Signal | Expected behavior |
|---|---|
| Redis `EVAL` latency | Stable and low under expected concurrency. |
| Redis key count | Quota keys grow with active users and expire by TTL. |
| `429` rate | Increases only when expected test quota is exhausted. |
| Provider request count | Does not increase for quota-rejected requests. |
| OmniRoute logs | Include `USER_RATE_LIMIT` allowed or denied messages. |
| PostgreSQL connection count | Stable; plan cache should reduce repeated plan lookups. |
| Plan cache keys | `plan-limits:pro` and `plan-limits:pro-max` appear after first lookup. |

## Debugging Failed Tests

| Failure | Check |
|---|---|
| No quota headers | Confirm request is Anthropic or OpenAI and API key maps to Customer Portal user. |
| Always `403` | Check `user_api_keys.omniroute_key_id` and `users.plan_id`. |
| Limits do not match plan | Clear `plan-limits:{planId}` Redis cache and re-read PostgreSQL plan rows. |
| Quota does not reset | Inspect sorted set scores and system clock. |
| Too many requests allowed under concurrency | Confirm tests use real Redis with Lua `EVAL` support. |
| Provider called on `429` | Check integration point before provider executor in [`chatCore.ts`](../OmniRoute/open-sse/handlers/chatCore.ts). |

## See Also

- [Implementation guide](./rate-limiting-implementation.md)
- [Deployment guide](./rate-limiting-deployment.md)
- [API documentation](./rate-limiting-api.md)
- [Operations runbook](./rate-limiting-operations.md)
