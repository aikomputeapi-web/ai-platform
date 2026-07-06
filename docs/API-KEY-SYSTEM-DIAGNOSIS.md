# API Key System — Diagnosis & Fix

> **Symptoms reported:** users say API keys are not working; the number of API
> keys shown in the Customer Portal does not match the number in OmniRoute.

This document records the full review of the API key system across the
Customer Portal and OmniRoute, the root causes of both symptoms, and the
fixes applied.

---

## 1. Architecture (the root of the problem)

There are **two separate services with two separate databases**, and the API
key lifecycle spans both:

| | Customer Portal | OmniRoute |
|---|---|---|
| Stack | Next.js + Prisma | Next.js + SQLite (`storage.sqlite`) |
| DB | PostgreSQL (`DATABASE_URL`) | SQLite file (`/app/data/storage.sqlite`) |
| Key table | `user_api_keys` (a **mapping**) | `api_keys` (the **real credential**) |
| Stores raw key? | **No** — only `omniroute_key_id` + `last_four` | **Yes** — `key`, `key_hash`, `key_prefix` |
| Validates keys? | No — it's a billing/management UI | **Yes** — every `/v1/*` request |

The portal never stores or validates the raw key. When a user creates a key
in the portal:

1. The portal calls OmniRoute's admin API (`POST /api/keys`) to mint the real
   credential in OmniRoute's SQLite `api_keys` table.
2. The portal stores a **mapping** row (`user_api_keys`) with
   `omniroute_key_id` pointing at the OmniRoute row and `last_four` for
   display.
3. The raw key is returned to the user **once** and never persisted in the
   portal.

When a user makes an inference request, they hit OmniRoute directly
(`/v1/chat/completions`, etc.) with the raw key in the `Authorization`
header. OmniRoute's [`validateApiKey()`](../OmniRoute/src/lib/db/apiKeys.ts:1170)
looks the key up in its own SQLite `api_keys` table. **The portal is not in
that path at all.**

This split is the source of both symptoms: the two databases have **no
transaction spanning them** and **no reconciliation**, so they drift.

---

## 2. Root causes

### 2.1 "API keys not working" — stale admin token + non-atomic writes

#### (a) The portal's OmniRoute client cached an admin token it could never refresh

In [`customer-portal/src/lib/omniroute.ts`](../customer-portal/src/lib/omniroute.ts:1)
the old `getAdminToken()` logged in to OmniRoute once and cached the
`auth_token` cookie for **24 hours**. OmniRoute's login route
([`OmniRoute/src/app/api/auth/login/route.ts:134`](../OmniRoute/src/app/api/auth/login/route.ts:134))
mints a JWT with a **30-day** expiry, but that JWT is signed with
`JWT_SECRET`. If any of the following happen, the cached token silently
becomes invalid and **every subsequent portal→OmniRoute call 401s**:

- `JWT_SECRET` is rotated (e.g. a redeploy with a new secret).
- The OmniRoute container is recreated and the old JWT is no longer
  recognised (depends on secret persistence).
- The admin password is rotated (`OMNIROUTE_ADMIN_PASSWORD` /
  `INITIAL_PASSWORD`) — though the JWT itself may still validate, the
  cookie can be invalidated by other middleware.

The old client had **no 401 retry**: a single stale token meant every key
create / delete / limit-update failed for up to 24h until the cache expired.
From the user's perspective, "I created a key but it doesn't work" — because
the key was never actually created in OmniRoute, or its plan limits were
never applied.

#### (b) Key creation was not atomic — a portal write failure leaked an unowned OmniRoute key

The old `POST /api/keys` flow in
[`customer-portal/src/app/api/keys/route.ts`](../customer-portal/src/app/api/keys/route.ts:1):

1. `createOmniRouteKey()` — creates the key in OmniRoute.
2. `updateKeyLimits()` — applies plan rate caps in OmniRoute.
3. `prisma.userApiKey.create()` — writes the mapping in the portal.

If step 3 threw (DB blip, unique-constraint, etc.), the OmniRoute key from
step 1 was **left behind with no portal owner**. The user saw a failure, but
a live, usable credential now existed in OmniRoute that no portal user
controlled — a security hole and a count mismatch.

#### (c) Key deletion deleted in OmniRoute first — a failure left a "working" key that 401s

The old `DELETE /api/keys` flow:

1. `deleteOmniRouteKey()` — delete in OmniRoute.
2. `prisma.userApiKey.delete()` — remove the portal mapping.

If step 1 threw (OmniRoute down, stale token), the portal mapping stayed and
the user kept seeing an "Active" key in the dashboard that **401'd on every
request** — exactly the reported symptom.

#### (d) `deleteOmniRouteKey()` swallowed all errors and returned `false`

The old implementation returned `res.ok` with no error surfacing. A 500 from
OmniRoute was indistinguishable from a 404, so the caller couldn't tell
"key already gone" from "OmniRoute is broken."

### 2.2 "Mismatched number of API keys" — no reconciliation

There is **no reconciliation** between the two databases anywhere in the
codebase (confirmed by searching both repos for `reconcil`, `syncKeys`,
`orphan`, `user_api_keys`). Drift accumulates from several sources:

1. **Non-atomic creation** (§2.1b) leaves unowned keys in OmniRoute →
   OmniRoute count > portal count.
2. **Non-atomic deletion** (§2.1c) leaves dead mappings in the portal →
   portal count > OmniRoute count.
3. **Keys created directly in the OmniRoute dashboard** (the admin UI at
   `/api/keys` is reachable by anyone with the admin password) are never
   reflected in the portal → OmniRoute count > portal count.
4. **`getOrCreateApiKey()` auto-creates keys** in OmniRoute for CLI-tool
   setup ([`OmniRoute/src/shared/services/apiKeyResolver.ts:24`](../OmniRoute/src/shared/services/apiKeyResolver.ts:24),
   [`OmniRoute/src/lib/services/apiKey.ts:21`](../OmniRoute/src/lib/services/apiKey.ts:21)).
   These "CLI Auto-Key" / service keys are legitimate OmniRoute keys with no
   portal mapping → OmniRoute count > portal count.
5. **Blue-green deploys** copy the SQLite volume
   ([`docker-compose.unified.yml:210`](../docker-compose.unified.yml:210)).
   If a deploy is rolled back, keys created during the green window exist in
   the green SQLite copy but not the blue one the portal still points at.

Because the portal's `GET /api/keys` only read its own `user_api_keys`
table, it happily displayed mappings to keys that no longer existed in
OmniRoute — so users saw keys that "should work" but 401'd.

---

## 3. Design: OmniRoute as single source of truth + automatic reconciliation

The durable design (now implemented) treats OmniRoute as the single source of
truth that **issues** keys, and the portal as a **mirror**. The flow:

1. **Portal requests a key from OmniRoute.** When a user creates a key, the
   portal calls `POST /api/keys` on OmniRoute with the title
   `{user.email} - {keyname}` ([`keys/route.ts:52`](../customer-portal/src/app/api/keys/route.ts:52)).
   OmniRoute mints the real credential (`sk-{machineId}-{keyId}-{crc8}`) in
   its SQLite `api_keys` table — it's the only place the raw key ever lives.
2. **Portal mirrors it.** The portal stores a `user_api_keys` mapping row
   (`omniroute_key_id` + `last_four`) and hands the raw key to the user once.
3. **A scheduled worker keeps them in sync.** The `api-key-reconciler`
   service polls `POST /api/admin/keys/reconcile` every 5 minutes and
   corrects any drift in both directions — so the two databases can't stay
   out of sync for more than a few minutes, regardless of cause.

This is "almost like one source of keys": OmniRoute owns the credential, the
portal owns the customer-facing mapping, and the reconciler makes the mirror
eventually consistent.

---

## 4. Fixes applied

### 4.1 Robust OmniRoute client — [`customer-portal/src/lib/omniroute.ts`](../customer-portal/src/lib/omniroute.ts:1)

- **401 retry:** `omnirouteFetch()` retries once on 401 by re-logging in and
  invalidating the cached token. A stale token no longer breaks every call
  for 24h.
- **Shorter cache (1h):** picks up password rotations without a portal
  restart, without hammering the login endpoint.
- **Real errors:** `createOmniRouteKey`, `deleteOmniRouteKey`, and
  `updateKeyLimits` now `throw` on non-2xx with the response body, instead of
  silently returning `false`. Callers can distinguish "OmniRoute down" from
  "key not found."
- **Idempotent delete:** `deleteOmniRouteKey` returns `true` for both 200
  and 404 (already gone), and throws on other errors.
- **New `listOmniRouteKeys()`:** fetches the full OmniRoute key list (masked)
  for reconciliation.

### 4.2 Atomic, safe key lifecycle — [`customer-portal/src/app/api/keys/route.ts`](../customer-portal/src/app/api/keys/route.ts:1)

- **Atomic creation:** OmniRoute key is created first; if the portal mapping
  write fails, the OmniRoute key is **rolled back** (deleted). If the
  rollback also fails, it's logged loudly as a `KEY ORPHAN ALERT`. No more
  unowned credentials.
- **Safe deletion:** the portal mapping is deleted **first**, so the key
  disappears from the user's dashboard immediately even if OmniRoute is
  unreachable. The OmniRoute delete is best-effort; a failure leaves an
  orphan that the reconciliation script reaps. The user never sees a
  "working" key that 401s.
- **Reconcile-on-list:** `GET /api/keys` now fetches both the portal mappings
  and the OmniRoute key list in parallel, and marks any portal mapping whose
  OmniRoute key is missing as `isActive=false`. The dashboard shows
  "Revoked" instead of a dead key, and logs a `user.key_reconciled_orphan`
  audit event.
- **Plan-limit failures are non-fatal:** if applying rate caps fails, the
  key still works (just uncapped) and the error is logged.

### 4.3 One-shot reconciliation script — [`customer-portal/scripts/reconcile-api-keys.mjs`](../customer-portal/scripts/reconcile-api-keys.mjs:1)

A standalone, operator-runnable script that fixes existing drift:

```
node scripts/reconcile-api-keys.mjs            # dry-run (report only)
node scripts/reconcile-api-keys.mjs --prune    # apply fixes
node scripts/reconcile-api-keys.mjs --prune --yes   # skip confirm
```

It:
1. Lists every key in OmniRoute and every mapping in the portal.
2. Marks portal mappings pointing at missing OmniRoute keys as inactive.
3. Reports (and with `--prune`, deletes) OmniRoute keys with no portal
   mapping — the unowned credentials that inflate OmniRoute's count.

Run this once to fix the current mismatch, then rely on the reconcile-on-list
in `GET /api/keys` to keep the portal side honest going forward.

---

### 4.4 Admin reconciliation endpoint — [`customer-portal/src/app/api/admin/keys/reconcile/route.ts`](../customer-portal/src/app/api/admin/keys/reconcile/route.ts:1)

`POST /api/admin/keys/reconcile` (admin-authed) does the full two-way sync:
marks dead portal mappings inactive and deletes orphaned OmniRoute keys. It
returns a JSON report of what was found and changed, and emits
`admin.keys.reconcile.*` audit events. `GET` runs a dry-run (`prune=false`).
This is the single source of truth for reconciliation logic — the worker and
the dashboard both call it.

### 4.5 Scheduled reconciliation worker — [`customer-portal/scripts/reconcile-api-keys-worker.mjs`](../customer-portal/scripts/reconcile-api-keys-worker.mjs:1)

A long-running worker (mirroring the `report-deliverer` pattern) that polls
the reconciliation endpoint every 5 minutes. This is the durable half of the
fix: drift is corrected automatically within minutes, with no operator
intervention and no reliance on a user loading their dashboard.

### 4.6 Worker wired into the deployment — [`docker-compose.unified.yml`](../docker-compose.unified.yml:283)

The `api-key-reconciler` service runs the worker as a first-class container
alongside `report-deliverer`, with a healthcheck (the worker writes
`/tmp/healthy` each successful cycle) and `restart: unless-stopped`.

---

## 5. How to run the fix

From the `customer-portal` directory (or the portal container):

```bash
# 1. Dry-run to see the current drift
node scripts/reconcile-api-keys.mjs

# 2. Apply the fix (marks dead portal mappings inactive, deletes orphaned
#    OmniRoute keys after a confirm prompt)
node scripts/reconcile-api-keys.mjs --prune
```

Required env: `DATABASE_URL`, `OMNIROUTE_INTERNAL_URL`,
`OMNIROUTE_ADMIN_PASSWORD` (all already set in the portal's deployment env
via [`docker-compose.unified.yml`](../docker-compose.unified.yml:101)).

No schema migration is needed — the fix uses the existing `is_active` column
on `user_api_keys` (already in the Prisma schema at
[`customer-portal/prisma/schema.prisma:68`](../customer-portal/prisma/schema.prisma:68)).

---

## 6. What this does NOT change (and why)

- **OmniRoute's key validation path is untouched.**
  [`validateApiKey()`](../OmniRoute/src/lib/db/apiKeys.ts:1170) already
  correctly checks `is_active`, `revoked_at`, `expires_at`, and `is_banned`
  with a 60s cache. The "keys not working" symptom was never in OmniRoute's
  validation — it was in the portal's failure to create/delete them
  correctly.
- **The env-key bypass is preserved.** `OMNIROUTE_API_KEY` / `ROUTER_API_KEY`
  still validate unconditionally
  ([`OmniRoute/src/sse/services/auth.ts:2407`](../OmniRoute/src/sse/services/auth.ts:2407)),
  which is the deployment bootstrap path.
- **No new DB column.** The fix reuses `user_api_keys.is_active`. No
  migration, no risk to existing data.

---

## 7. Why this can't happen again

The original design had two databases with no transaction spanning them and
no reconciliation — drift was *inevitable* and *invisible* until a user
reported a broken key. The new design closes that gap at three layers:

1. **Less drift created.** Atomic create/delete (§4.2) and the robust admin
   client (§4.1) mean the normal key lifecycle no longer leaks orphaned keys
   or dead mappings.
2. **Drift self-heals on dashboard load.** `GET /api/keys` reconciles on
   every read (§4.2), so a user who loads their API Keys page always sees an
   accurate state — dead keys show "Revoked" instead of 401'ing.
3. **Drift is corrected automatically on a schedule.** The
   `api-key-reconciler` worker (§4.5/§4.6) polls every 5 minutes, so even
   drift from sources outside the portal's control (blue-green rollbacks,
   keys made directly in the OmniRoute dashboard, auto-created CLI/service
   keys, a rollback failure during atomic create) is corrected within
   minutes — no operator intervention, no reliance on a user logging in.

The remaining theoretical drift window is the 5-minute poll interval. If
that's ever too long, lower `RECONCILE_INTERVAL_SECONDS` in
[`docker-compose.unified.yml`](../docker-compose.unified.yml:283). The
one-shot script (§4.3) remains available for manual cleanup, and the admin
endpoint (§4.4) can be triggered on-demand from the dashboard or a CI job.
