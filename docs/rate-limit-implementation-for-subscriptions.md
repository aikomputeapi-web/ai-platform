# Rate Limit Implementation for Subscription Plans

## Purpose

This document describes how to enforce the subscription limits for the new plans:

- **Pro**: $5/month
- **Max 5x**: $25/month
- **Max 20x**: $50/month

All three plans should preserve the same usage envelope as the Anthropic-equivalent tiers, while being priced below the direct comparison tiers.

## Plan Definition

The customer portal already models plans in [`schema.prisma`](../customer-portal/prisma/schema.prisma:37) with:

- `requestsPerMinute`
- `requestsPerDay`
- `requestsPerMonth`
- `allowedModels`
- `priceCents`
- `stripePriceId`

That means the rate limit implementation should remain plan-driven rather than hardcoded in the request pipeline.

## Proposed Plan Limits

### Pro

- `priceCents`: `500`
- `requestsPerMinute`: keep existing safe default or tune to traffic profile
- `requestsPerDay`: aligned to daily quota policy
- `requestsPerMonth`: `3000`
- `allowedModels`: Anthropic and OpenAI model set used by the product

### Max 5x

- `priceCents`: `2500`
- `requestsPerMinute`: higher than Pro, but still bounded
- `requestsPerDay`: `400`
- `requestsPerMonth`: `6000`
- `allowedModels`: same Anthropic + OpenAI set, with higher priority

### Max 20x

- `priceCents`: `5000`
- `requestsPerMinute`: highest of all tiers, but still bounded
- `requestsPerDay`: `800`
- `requestsPerMonth`: `12000`
- `allowedModels`: same Anthropic + OpenAI set, with highest priority

## Enforcement Strategy

### 1. Resolve the active plan at request time

The gateway should resolve:

1. API key
2. user record
3. active subscription plan
4. plan quotas

This matches the structure in [`src/types/rateLimit.ts`](../OmniRoute/src/types/rateLimit.ts:5), where the plan identity and quota windows are already represented.

### 2. Apply a subscription quota check before provider execution

The request flow should be:

1. authenticate request
2. resolve user plan
3. check minute/day/month quota
4. reject with `429` if any window is exhausted
5. otherwise forward to Anthropic or OpenAI

### 3. Keep provider throttling separate

The subscription quota should not replace provider-level protection. The platform still needs upstream safeguards for:

- Anthropic request bursts
- OpenAI request bursts
- retry storms
- provider queue protection

### 4. Count one accepted request as one quota unit

The quota system should count:

- one user-visible request
- not internal retries
- not provider-side retries
- not duplicate streaming retries

## Window Logic

The quota windows should stay consistent with the subscription UX:

- **Minute window**: protects against burst abuse
- **Day window**: supports fair-use controls
- **Month window**: matches billing expectations

For the paid tiers, the user-facing display should emphasize the Anthropic-like windows:

- 5-hour usage window
- daily usage window
- weekly usage window
- monthly usage window

## Suggested Data Model Approach

Use the existing [`Plan`](../customer-portal/prisma/schema.prisma:37) table as the source of truth and add any missing fields only if needed for:

- 5-hour rolling quota
- weekly quota
- monthly quota reset logic
- provider-family restrictions
- display labels for landing page and pricing page

## Implementation Notes

### If you keep the current minute/day/month model

Then map the user-facing Anthropic-style claims into those windows carefully:

- 5-hour window can be derived from a sliding window quota layer
- weekly quota can be enforced via a 7-day rolling counter
- monthly quota can remain the billing-period counter

### If you want exact product parity in UX

Add a new rolling-window quota structure so the UI can expose:

- 5-hour remaining
- weekly remaining
- monthly remaining

That would align the public plan language with the tier preview while preserving the backend provider throttling.

## Recommended Enforcement Order

1. Auth validation
2. API key lookup
3. Subscription plan lookup
4. Rolling quota check
5. Provider scheduling
6. Provider API call
7. Usage logging

## Recommended Error Behavior

When a plan quota is exceeded, return a structured `429` response that includes:

- plan id
- quota window
- limit
- remaining
- reset timestamp

This makes the UI and client messaging easier to keep consistent.

## Operational Guidance

- Seed plan rows for Pro, Max 5x, and Max 20x in the customer portal database.
- Synchronize plan limits into Redis for fast request-path enforcement.
- Keep plan changes admin-editable so future pricing changes do not require code edits.
- Expose quota state in the dashboard and API responses.

## Summary

Use the plan table as the source of truth, enforce quotas before provider routing, and keep Anthropic-like limits visible in the UI while pricing the plans at 1/5th the cost.
