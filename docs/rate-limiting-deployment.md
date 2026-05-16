# Rate Limiting Deployment Guide

## Overview

This guide explains how to deploy the Pro and Pro Max subscription rate limiting system for OmniRoute. The system depends on Customer Portal PostgreSQL data, Redis quota tracking, and the OmniRoute chat integration in [`chatCore.ts`](../OmniRoute/open-sse/handlers/chatCore.ts).

Deployment has four main phases:

1. Prepare PostgreSQL and Redis.
2. Install required Node dependencies.
3. Run Customer Portal Prisma migrations and seed plans.
4. Configure and verify OmniRoute enforcement.

## Prerequisites

| Requirement | Purpose |
|---|---|
| Node.js version supported by [`OmniRoute/package.json`](../OmniRoute/package.json) | Runs OmniRoute and test scripts. |
| PostgreSQL | Stores Customer Portal users, API key mappings, and plan definitions. |
| Redis | Stores quota counters and plan-limit cache. |
| Customer Portal database schema | Provides `users`, `plans`, and `user_api_keys` tables. |
| OmniRoute API keys linked to Customer Portal users | Required for plan lookup by `omniroute_key_id`. |

## Environment Variables

Configure these variables in the OmniRoute environment. They are documented in [`.env.example`](../OmniRoute/.env.example).

```bash
# Customer Portal PostgreSQL connection used by OmniRoute plan lookups.
PORTAL_DATABASE_URL=postgresql://customer_portal_user:change_me@postgres.example.com:5432/customer_portal

# Redis connection used for quota counters and plan cache.
REDIS_URL=redis://redis.example.com:6379/0
# Alternative supported name:
# REDIS_CONNECTION_STRING=redis://redis.example.com:6379/0

# Enable subscription quota checks.
USER_RATE_LIMIT_ENABLED=true

# Keep false in production unless an incident commander explicitly chooses fail-open behavior.
USER_RATE_LIMIT_FAIL_OPEN=false
```

### Customer Portal Variables

Customer Portal Prisma uses `DATABASE_URL` for migrations and seeding:

```bash
DATABASE_URL=postgresql://customer_portal_user:change_me@postgres.example.com:5432/customer_portal
```

### Recommended Production Defaults

| Variable | Recommended value | Why |
|---|---|---|
| `USER_RATE_LIMIT_ENABLED` | `true` | Enforces paid-plan quotas. |
| `USER_RATE_LIMIT_FAIL_OPEN` | `false` | Prevents unbounded provider spend during Redis or PostgreSQL failures. |
| `PORTAL_DATABASE_URL` | PostgreSQL URL with least required privileges | Allows plan reads from OmniRoute. |
| `REDIS_URL` | Dedicated Redis database or namespace | Keeps quota keys operationally isolated. |

## Dependency Installation

The required runtime dependencies are already listed in [`OmniRoute/package.json`](../OmniRoute/package.json): `pg` and `redis`.

If deploying from a fresh checkout, install dependencies from the project root components:

```bash
cd /home/stevenleblanc62920/ai-platform/OmniRoute && npm install
cd /home/stevenleblanc62920/ai-platform/customer-portal && npm install
```

If adding the dependencies manually to an older branch:

```bash
cd /home/stevenleblanc62920/ai-platform/OmniRoute && npm install pg redis
```

## Database Migration Steps

The plan seed migration is located at [`20260513_add_pro_plans/migration.sql`](../customer-portal/prisma/migrations/20260513_add_pro_plans/migration.sql), and the Prisma seed script is [`seed.mjs`](../customer-portal/prisma/seed.mjs).

### 1. Back up PostgreSQL

```bash
pg_dump "$DATABASE_URL" > customer_portal_before_rate_limits.sql
```

### 2. Apply Prisma migrations

```bash
cd /home/stevenleblanc62920/ai-platform/customer-portal
DATABASE_URL="postgresql://customer_portal_user:change_me@postgres.example.com:5432/customer_portal" npx prisma migrate deploy
```

### 3. Seed or update plans

```bash
cd /home/stevenleblanc62920/ai-platform/customer-portal
DATABASE_URL="postgresql://customer_portal_user:change_me@postgres.example.com:5432/customer_portal" npm run db:seed
```

### 4. Verify plan rows

```sql
SELECT id, name, price_cents, requests_per_minute, requests_per_day, requests_per_month
FROM plans
WHERE id IN ('pro', 'pro-max')
ORDER BY price_cents;
```

Expected rows:

| id | name | price_cents | requests_per_minute | requests_per_day | requests_per_month |
|---|---|---:|---:|---:|---:|
| `pro` | `Pro` | `500` | `60` | `10000` | `300000` |
| `pro-max` | `Pro Max` | `2500` | `300` | `100000` | `3000000` |

## Configuration Steps

### 1. Confirm Customer Portal API key mapping

OmniRoute resolves a plan through this relationship:

```text
user_api_keys.omniroute_key_id -> users.id -> users.plan_id -> plans.id
```

Check a sample key ID:

```sql
SELECT
  k.omniroute_key_id,
  u.id AS user_id,
  u.email,
  u.plan_id,
  p.name,
  p.requests_per_minute,
  p.requests_per_day,
  p.requests_per_month
FROM user_api_keys k
JOIN users u ON u.id = k.user_id
JOIN plans p ON p.id = u.plan_id
WHERE k.omniroute_key_id = 'replace-with-omniroute-key-id';
```

### 2. Configure OmniRoute environment

Add the required variables to the OmniRoute runtime environment:

```bash
PORTAL_DATABASE_URL=postgresql://customer_portal_user:change_me@postgres.example.com:5432/customer_portal
REDIS_URL=redis://redis.example.com:6379/0
USER_RATE_LIMIT_ENABLED=true
USER_RATE_LIMIT_FAIL_OPEN=false
```

### 3. Restart OmniRoute

Use the deployment method for the environment, for example:

```bash
cd /home/stevenleblanc62920/ai-platform/OmniRoute && npm run build && npm run start
```

### 4. Confirm Redis connectivity

```bash
redis-cli -u redis://redis.example.com:6379/0 PING
```

Expected response:

```text
PONG
```

## Verification Steps

### Verify a successful request includes quota headers

```bash
curl -i https://omniroute.example.com/v1/chat/completions \
  -H 'Authorization: Bearer YOUR_OMNIROUTE_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"Reply with ok"}],
    "stream": false
  }'
```

Look for these headers:

```text
X-RateLimit-Limit-Minute: 60
X-RateLimit-Remaining-Minute: 59
X-RateLimit-Limit-Day: 10000
X-RateLimit-Remaining-Day: 9999
X-RateLimit-Limit-Month: 300000
X-RateLimit-Remaining-Month: 299999
```

### Verify Redis keys are created

```bash
redis-cli -u redis://redis.example.com:6379/0 --scan --pattern 'user-quota:*'
redis-cli -u redis://redis.example.com:6379/0 --scan --pattern 'plan-limits:*'
```

### Verify PostgreSQL plan lookup path

The OmniRoute lookup query is implemented in [`portalDb.ts`](../OmniRoute/src/lib/portalDb.ts). Confirm that the API key ID exists and points to a non-free paid plan.

### Verify feature flag disables enforcement

Set:

```bash
USER_RATE_LIMIT_ENABLED=false
```

Restart OmniRoute and repeat requests. Requests should proceed without being blocked by user quota, while the response may still include quota information built from plan data.

### Verify fail-closed behavior

In a staging environment only:

1. Set `USER_RATE_LIMIT_FAIL_OPEN=false`.
2. Stop Redis or point `REDIS_URL` to an invalid endpoint.
3. Send an Anthropic or OpenAI request.
4. Confirm the request is denied rather than silently bypassing quota.

## Rollback Procedure

### Option 1: Disable enforcement with feature flag

This is the preferred first rollback.

```bash
USER_RATE_LIMIT_ENABLED=false
```

Restart OmniRoute. This keeps the code deployed but bypasses quota enforcement.

### Option 2: Temporary fail-open during dependency incident

Use only when the business accepts the risk of unbounded usage during an incident:

```bash
USER_RATE_LIMIT_FAIL_OPEN=true
```

Restart OmniRoute and monitor provider spend and traffic volume closely.

### Option 3: Revert application deployment

Deploy the previous OmniRoute artifact that does not call [`UserRateLimitManager`](../OmniRoute/open-sse/services/userRateLimitManager.ts).

### Option 4: Revert plan data

If seeded plan limits are incorrect, update them in PostgreSQL instead of deleting plans referenced by users:

```sql
UPDATE plans
SET requests_per_minute = 60,
    requests_per_day = 10000,
    requests_per_month = 300000
WHERE id = 'pro';

UPDATE plans
SET requests_per_minute = 300,
    requests_per_day = 100000,
    requests_per_month = 3000000
WHERE id = 'pro-max';
```

Then clear plan cache:

```bash
redis-cli -u redis://redis.example.com:6379/0 DEL plan-limits:pro plan-limits:pro-max
```

## Troubleshooting Deployment

| Symptom | Likely cause | Fix |
|---|---|---|
| `403 No active subscription plan found` | API key is not mapped in `user_api_keys`, or user has no valid `plan_id`. | Link the OmniRoute key ID to a Customer Portal user and paid plan. |
| `dependency_unavailable` | Redis or PostgreSQL lookup failed and fail-open is disabled. | Check `REDIS_URL`, `PORTAL_DATABASE_URL`, network ACLs, and service health. |
| Missing quota headers | Request did not route through Anthropic or OpenAI path, or plan lookup failed earlier. | Test with a known Anthropic or OpenAI request and valid Customer Portal API key mapping. |
| Limits are stale after plan update | Redis plan cache still contains old values. | Delete `plan-limits:{planId}` or wait for the 5-minute TTL. |
| Unexpected low limits | Plan lookup failed and fallback free plan was used. | Check OmniRoute logs for PostgreSQL failures and verify plan ID normalization. |

## See Also

- [Implementation guide](./rate-limiting-implementation.md)
- [Testing guide](./rate-limiting-testing.md)
- [Operations runbook](./rate-limiting-operations.md)
- [API documentation](./rate-limiting-api.md)
