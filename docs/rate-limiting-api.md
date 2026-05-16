# Rate Limiting API Documentation

## Overview

OmniRoute enforces subscription request quotas for Pro and Pro Max users on Anthropic and OpenAI traffic. API clients receive quota headers on successful requests and structured `429 Too Many Requests` responses when a quota window is exhausted.

The API behavior is implemented in [`chatCore.ts`](../OmniRoute/open-sse/handlers/chatCore.ts), and quota metadata is shaped by [`QuotaInfo`](../OmniRoute/src/types/rateLimit.ts).

## Subscription Quotas

| Tier | Plan ID | Requests per minute | Requests per day | Requests per month |
|---|---|---:|---:|---:|
| Pro | `pro` | `60` | `10,000` | `300,000` |
| Pro Max | `pro-max` | `300` | `100,000` | `3,000,000` |

Each accepted Anthropic or OpenAI request consumes one request unit from all active quota windows.

## Rate Limit Headers

Successful requests include subscription quota headers when the API key maps to a Customer Portal plan.

| Header | Description | Example |
|---|---|---|
| `X-RateLimit-Limit-Minute` | Total requests allowed in the current minute window. | `60` |
| `X-RateLimit-Remaining-Minute` | Requests remaining in the current minute window. | `59` |
| `X-RateLimit-Limit-Day` | Total requests allowed in the UTC day window. | `10000` |
| `X-RateLimit-Remaining-Day` | Requests remaining in the UTC day window. | `9999` |
| `X-RateLimit-Limit-Month` | Total requests allowed in the UTC month window. | `300000` |
| `X-RateLimit-Remaining-Month` | Requests remaining in the UTC month window. | `299999` |
| `Retry-After` | Present on `429` responses. Number of seconds before retrying. | `42` |

### Header Example

```text
HTTP/1.1 200 OK
Content-Type: application/json
X-RateLimit-Limit-Minute: 60
X-RateLimit-Remaining-Minute: 59
X-RateLimit-Limit-Day: 10000
X-RateLimit-Remaining-Day: 9999
X-RateLimit-Limit-Month: 300000
X-RateLimit-Remaining-Month: 299999
```

### Notes

- Remaining counts are calculated after the accepted request is reserved.
- Headers apply to subscription quotas, not upstream provider quotas.
- Existing provider-level throttling may still queue or retry requests after the subscription check passes.
- Reset timestamps are included in the internal `quota` object on errors, but the currently emitted success headers only include limit and remaining counts.

## Error Responses

When a quota window is exhausted, OmniRoute returns `429 Too Many Requests` before sending the request to Anthropic or OpenAI.

### 429 Headers

```text
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 42
X-RateLimit-Limit-Minute: 60
X-RateLimit-Remaining-Minute: 0
X-RateLimit-Limit-Day: 10000
X-RateLimit-Remaining-Day: 9940
X-RateLimit-Limit-Month: 300000
X-RateLimit-Remaining-Month: 299940
```

### 429 Body Format

The implemented response body follows this shape:

```json
{
  "error": {
    "message": "Rate limit exceeded for Pro tier. Try again in 42s.",
    "type": "rate_limit_error",
    "code": "user_rate_limit_exceeded",
    "quota": {
      "userId": "user_123",
      "planId": "pro",
      "planName": "Pro",
      "source": "database",
      "minute": {
        "limit": 60,
        "used": 60,
        "remaining": 0,
        "resetAt": "2026-05-14T00:22:00.000Z",
        "isUnlimited": false
      },
      "day": {
        "limit": 10000,
        "used": 60,
        "remaining": 9940,
        "resetAt": "2026-05-15T00:00:00.000Z",
        "isUnlimited": false
      },
      "month": {
        "limit": 300000,
        "used": 60,
        "remaining": 299940,
        "resetAt": "2026-06-01T00:00:00.000Z",
        "isUnlimited": false
      }
    }
  }
}
```

### Error Fields

| Field | Description |
|---|---|
| `error.message` | Human-readable retry message. |
| `error.type` | Always `rate_limit_error` for subscription quota rejections. |
| `error.code` | Always `user_rate_limit_exceeded` for quota exhaustion. |
| `error.quota.userId` | Customer Portal user ID used for quota tracking. |
| `error.quota.planId` | Plan ID, such as `pro` or `pro-max`. |
| `error.quota.planName` | Display name for the plan. |
| `error.quota.source` | Source of plan data: `redis`, `database`, or `fallback`. |
| `error.quota.minute` | Minute window limit, usage, remaining count, and reset timestamp. |
| `error.quota.day` | Day window limit, usage, remaining count, and reset timestamp. |
| `error.quota.month` | Month window limit, usage, remaining count, and reset timestamp. |

## Quota Information for Clients

Clients should use response headers as the primary lightweight quota signal.

### Checking Remaining Quota from Headers

```js
const response = await fetch("https://omniroute.example.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hello" }],
  }),
});

const remainingMinute = Number(response.headers.get("x-ratelimit-remaining-minute"));
const remainingDay = Number(response.headers.get("x-ratelimit-remaining-day"));
const remainingMonth = Number(response.headers.get("x-ratelimit-remaining-month"));

if (response.status === 429) {
  const retryAfterSeconds = Number(response.headers.get("retry-after") || "60");
  const body = await response.json();
  console.warn("Quota exceeded", { retryAfterSeconds, quota: body.error?.quota });
}
```

### Client-Side Backoff

When receiving `429`:

1. Read `Retry-After`.
2. Pause requests for at least that many seconds.
3. Apply jitter for multiple workers.
4. Do not retry immediately in a tight loop.
5. If month quota is exhausted, stop automated retries and notify the user.

Example:

```js
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFromRetryAfter(response) {
  const retryAfter = Number(response.headers.get("retry-after") || "60");
  const jitterMs = Math.floor(Math.random() * 1000);
  await sleep(retryAfter * 1000 + jitterMs);
}
```

## Best Practices for API Clients

### Recommended

- Track `X-RateLimit-Remaining-Minute` to avoid burst rejections.
- Track `X-RateLimit-Remaining-Day` and `X-RateLimit-Remaining-Month` for user-facing quota displays.
- Respect `Retry-After` on every `429`.
- Use exponential backoff with jitter for automated retry systems.
- Stop retrying when daily or monthly remaining quota is `0`.
- Avoid parallel request bursts near the plan limit.
- Treat streaming and non-streaming requests as one quota unit each.
- Surface upgrade guidance to Pro users who repeatedly hit daily or monthly limits.

### Avoid

- Do not assume provider throttling and subscription quota are the same thing.
- Do not retry `429` responses immediately.
- Do not create multiple API keys to bypass quotas; quota is tied to the Customer Portal user.
- Do not rely on exact reset timing for high-frequency schedulers; use `Retry-After`.
- Do not ignore quota headers in background workers.

## Migration Guide for Existing API Users

Existing API clients should be updated to handle subscription quota responses.

### 1. Log Quota Headers

Add logging for the new headers:

```text
X-RateLimit-Limit-Minute
X-RateLimit-Remaining-Minute
X-RateLimit-Limit-Day
X-RateLimit-Remaining-Day
X-RateLimit-Limit-Month
X-RateLimit-Remaining-Month
Retry-After
```

### 2. Handle HTTP 429 Explicitly

Before this system, some clients may have treated `429` as only an upstream provider event. Clients should now parse the response body and look for:

```json
{
  "error": {
    "type": "rate_limit_error",
    "code": "user_rate_limit_exceeded"
  }
}
```

### 3. Add Retry Scheduling

For short minute-window rejections, retry after the `Retry-After` value. For daily or monthly exhaustion, pause work until quota resets or ask the user to upgrade.

### 4. Update User Interface

Display remaining day and month quota where possible. For Pro users, include an upgrade path to Pro Max when daily or monthly remaining quota is low.

### 5. Review Background Jobs

Batch jobs and automation should cap concurrency and total requests according to the user's plan.

## Example Client Behavior

```text
If request succeeds:
  read quota headers
  update local quota display
  continue normal processing

If response is 429:
  parse Retry-After
  parse error.quota
  if minute remaining is 0:
    retry after Retry-After plus jitter
  else if day remaining is 0:
    pause until daily reset and notify user
  else if month remaining is 0:
    pause until monthly reset and show upgrade or billing guidance
```

## See Also

- [Implementation guide](./rate-limiting-implementation.md)
- [Deployment guide](./rate-limiting-deployment.md)
- [Testing guide](./rate-limiting-testing.md)
- [Operations runbook](./rate-limiting-operations.md)
