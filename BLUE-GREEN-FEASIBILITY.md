# Feasibility Report: Blue-Green Zero-Downtime Deployment for AI-Platform

**Date:** 2026-06-23
**Prepared for:** AI-Platform Operations
**Status:** Feasible with phased approach — see recommendation

---

## 1. Executive Summary

Blue-green deployment is **feasible** for the AI-Platform, but only with a carefully phased approach that accounts for OmniRoute's SQLite-based architecture and SSE streaming constraints. A previous attempt at dual-instance operation failed due to concurrent SQLite access — this report explains why blue-green is different, what risks remain, and how to implement it safely.

**Bottom line:** Near-zero-downtime (sub-second for new connections) is achievable in **2-3 days of effort** using an nginx upstream-swap strategy. True zero-downtime (no disruption to in-flight SSE streams) requires an additional drain-mode feature in OmniRoute and is a **1-2 week effort**. Full horizontal scalability is a longer-term initiative requiring SQLite-to-PostgreSQL migration.

---

## 2. Current Deployment Architecture

### 2.1 Infrastructure

| Resource | Value |
|----------|-------|
| Server | GCP e2-standard-4 (4 vCPU, 15 GB RAM) |
| Disk | 96 GB (79 GB used, 18 GB free) |
| Docker | v29.1.3, Compose v5.1.4 |
| Nginx | v1.28.0 (TLS termination, reverse proxy, rate limiting) |
| CI/CD | GitHub Actions → SSH → `deploy.sh` |

### 2.2 Running Services

```
Internet → Nginx (SSL + rate limiting)
              ├── yourdomain.com/v1    → OmniRoute API      (:20129)
              ├── yourdomain.com/      → Customer Portal     (:3000)
              └── admin.domain.com/    → OmniRoute Dashboard (:20128)

Supporting services:
  cliproxyapi             (:8317, internal sidecar)
  report-deliverer        (background worker)
  free-models-extractor   (background worker)
  omniroute-redis         (:6379, local cache)
  proxy_pool              (:5010, proxy rotation)
```

### 2.3 State Management

| Component | State Store | Externalized? |
|-----------|-------------|---------------|
| Customer Portal | PostgreSQL (GCP Cloud SQL) | Yes — fully externalized, stateless containers |
| OmniRoute | SQLite (`better-sqlite3`, WAL mode) in `ai-omniroute-data` volume (1.5 GB) | **No** — local file, single-process only |
| OmniRoute in-memory | Quota cache, circuit breakers, model lockouts, credential health | **No** — per-process, not shared |
| Redis | GCP Memorystore (external) + local `omniroute-redis` | Yes for session/rate-limit data |
| CLIProxyAPI | `ai-cliproxyapi-data` volume | Local volume |

### 2.4 Current Deploy Flow (`deploy.sh`)

The current script already implements a **rolling restart with health checks and rollback**:

1. Build new Docker images (only changed services)
2. Tag backup images (`omniroute:backup`, `customer-portal:backup`)
3. `docker compose up -d --no-deps --remove-orphans <svc>` — recreates the single container
4. Wait for healthcheck (up to 60 seconds, 30 attempts)
5. If unhealthy → restore backup image and recreate → exit with error
6. Reload nginx if config changed

**Downtime window:** `docker compose up -d` with `--force-recreate` stops the old container before starting the new one. This creates a **5-15 second gap** where nginx returns 502s for all requests, including in-flight SSE streams which are terminated abruptly.

---

## 3. Previous Dual-Instance Attempt — Lessons Learned

The project previously ran dual OmniRoute instances (`omniroute-1` / `omniroute-2`) with nginx load-balancing. This was **reverted to single instance** due to severe issues (documented in `CONNECTION_ISSUES_FIX.md`):

### 3.1 Root Causes of Failure

| Problem | Impact |
|---------|--------|
| **SQLite concurrent writes** | Both instances wrote to the same `storage.sqlite` file via the shared `omniroute_data` volume. SQLite locks the database during writes → write conflicts, stale reads, corrupted state (one instance marks a provider "banned", the other reads it as active) |
| **In-memory state divergence** | Each instance maintained independent quota caches, model lockouts, circuit breakers, and credential health status. Load-balanced requests hit instances with inconsistent state |
| **Duplicate background jobs** | Both instances ran credential health checks every 5 minutes on the same provider accounts → triggered rate limits, looked like suspicious activity, wrote conflicting results |
| **Load-balancing confusion** | Admin panel requests hit different instances per page load → flickering status, inconsistent API routing decisions |

### 3.2 Why Blue-Green Is Different

| Aspect | Failed Dual-Instance | Blue-Green |
|--------|---------------------|------------|
| Concurrent traffic | Both instances serve traffic simultaneously | Only one instance serves traffic at any time |
| SQLite access | Two processes writing simultaneously (unsafe) | Only one process has the SQLite file open (safe) |
| In-memory state | Diverges between two live instances | Old instance's state is irrelevant once traffic switches |
| Background jobs | Run on both instances simultaneously | Run on only the active instance |
| Nginx config | Load-balances across both (round-robin) | Points to one upstream at a time, swapped on deploy |

**Blue-green avoids the root causes of the previous failure** because the two environments are never both serving production traffic simultaneously. The SQLite file is only ever opened by one process at a time.

---

## 4. Technical Constraints & Risks

### 4.1 SQLite Single-Process Constraint (CRITICAL)

OmniRoute uses `better-sqlite3` with WAL mode (`src/lib/db/core.ts:1336`). While WAL allows concurrent readers, it still permits only **one writer at a time**. The `busy_timeout` is set to 5000ms (`core.ts:1337`).

**Risk during blue-green switch:** If the green instance starts while blue is still running and both mount the same `omniroute_data` volume, both will open the SQLite file. During the overlap window (green boot + health check ≈ 60s), concurrent writes could cause `SQLITE_BUSY` errors or state corruption — the same class of bug that caused the previous failure.

**Mitigation:** Ensure blue is fully stopped before green starts, OR use separate volumes with a pre-deploy SQLite copy. See Section 6 for recommended approach.

### 4.2 SSE Streaming Disruption (HIGH)

OmniRoute serves LLM responses via Server-Sent Events (SSE) with timeouts up to 600 seconds (`nginx.conf:126-127`). When the old instance is stopped:

- **In-flight SSE streams are terminated** — users see truncated responses mid-generation
- **No mechanism to migrate streams** between instances (SSE is a persistent TCP connection)
- Clients must retry, which means re-sending the full prompt (no stream resumption)

**This is inherent to any deployment strategy that replaces the serving process.** The current single-instance restart has the same problem. Blue-green does not make this worse — it makes it better by minimizing the window.

### 4.3 Background Job Duplication (MEDIUM)

OmniRoute runs scheduled background jobs:
- Credential health checks (every 5 min, configurable via `CREDENTIAL_HEALTH_CHECK_INTERVAL`)
- DB health checks (every 6 hours, `core.ts:1140`)
- Free models extraction (every 24h)

If both blue and green are running simultaneously during the switch, both will execute these jobs → duplicate provider API calls, potential rate-limit triggers.

**Mitigation:** Stop blue before green's job schedulers activate, or add a startup delay / leader election env var.

### 4.4 Database Migration Conflicts (MEDIUM)

OmniRoute runs schema migrations at startup (`core.ts:1358`, `runMigrations()`). Migrations are idempotent and run in transactions, but if both instances start simultaneously and attempt migrations on the same SQLite file, there could be lock contention.

**Mitigation:** Run migrations as a discrete step before starting the green instance (already the pattern for customer-portal Prisma migrations in `deploy.sh:233`).

### 4.5 OmniRoute Data Volume (1.5 GB)

The `ai-omniroute-data` volume is 1.5 GB (SQLite DB + call log artifacts). Copying this between volumes adds ~5-10 seconds on local disk. This is acceptable but must be accounted for in the deploy timeline.

### 4.6 Resource Capacity (LOW)

Current memory usage of platform containers: ~760 MB actual / ~2.8 GB in limits. Blue-green requires a second `omniroute` (~477 MB actual / 1.5 GB limit) and `customer-portal` (~111 MB / 512 MB limit) during the switch window.

| Resource | Current Used | Available | Blue-Green Peak | Feasible? |
|----------|-------------|-----------|-----------------|-----------|
| RAM | 8.6 GB | 7.0 GB | +2 GB (temporary) | Yes |
| Disk | 79 GB / 96 GB | 18 GB | +1.5 GB (volume copy) | Yes |
| CPU | Low (most containers idle) | 4 vCPU | +1 vCPU peak (build) | Yes |

---

## 5. Component-Level Feasibility

### 5.1 Customer Portal — Fully Feasible (Easy)

The customer portal is a stateless Next.js app backed by external PostgreSQL (Cloud SQL) and external Redis (Memorystore). Blue-green is trivial:

- Build new image → Start green container on alternate port → Health check → Switch nginx → Stop blue
- No state to migrate, no volume conflicts
- Prisma migrations run as a separate pre-deploy step (already the pattern in `deploy.sh:233`)

### 5.2 OmniRoute — Feasible with Constraints (Moderate)

OmniRoute is the challenging component due to SQLite + in-memory state + background jobs. Blue-green is feasible but requires careful orchestration:

- Must ensure only one instance has the SQLite volume mounted and writing at any time
- Background job schedulers must not overlap between instances
- The deploy script must handle the volume handoff correctly

### 5.3 CLIProxyAPI — Feasible (Easy)

Sidecar with its own volume (`ai-cliproxyapi-data`). Can be recreated independently — OmniRoute reconnects via `CLIPROXYAPI_HOST` env var. Low risk.

### 5.4 Background Workers (report-deliverer, free-models-extractor) — Feasible (Easy)

Workers are stateless pollers. Can be recreated after the main services switch. No zero-downtime concern — brief gap in report delivery or model extraction is acceptable.

### 5.5 Nginx — Feasible (Easy)

Nginx `reload` is near-instant (re-reads config, gracefully finishes old worker processes, starts new ones). New connections immediately route to the new upstream. This is the standard blue-green traffic-switch mechanism.

---

## 6. Recommended Approach — Phased Implementation

### Phase 1: Nginx Upstream-Swap Blue-Green (Near-Zero Downtime)

**Effort:** 2-3 days
**Downtime:** Sub-second for new connections; in-flight SSE streams terminated (same as current)
**Risk:** Low — reuses existing infrastructure, no OmniRoute code changes

#### Strategy

```
                    ┌──────────────────────────────────┐
                    │            NGINX                 │
                    │  upstream omniroute_dashboard {  │
                    │    server 127.0.0.1:20128;  ←── active slot (blue)    │
                    │    server 127.0.0.1:20138  down; ←── inactive slot (green) │
                    │  }                               │
                    └──────────────────────────────────┘
```

- **Blue slot:** ports 20128/20129 (current), volume `ai-omniroute-data`
- **Green slot:** ports 20138/20139 (new), volume `ai-omniroute-data-green`

#### Deploy Flow

```
1. Build green images (omniroute, customer-portal)
2. Copy SQLite DB: docker run --rm -v ai-omniroute-data:ro -v ai-omniroute-data-green:/dst alpine cp /data/storage.sqlite* /dst/
   (or use a shared volume — see decision point below)
3. Start green containers on alternate ports
4. Wait for green healthcheck (up to 60s)
5. If green is unhealthy → abort, keep blue running, alert
6. If green is healthy → swap nginx upstream (sed + nginx -t + nginx -s reload)
7. Wait 5s for nginx workers to pick up new config
8. Stop blue containers
9. Tag green images as backup for rollback
10. Green is now the new blue
```

#### Rollback

```
1. Swap nginx upstream back to blue (still running for drain period, or restart from backup image)
2. If blue was stopped: docker tag omniroute:backup omniroute:cli → restart on blue ports
3. Nginx reload → traffic returns to blue
```

#### Key Decision: Shared Volume vs. Copied Volume

| Option | Pros | Cons | Recommended? |
|--------|------|------|-------------|
| **Shared volume** (both mount `ai-omniroute-data`) | No copy step, always current data | Risk of concurrent SQLite access during overlap window | No — too similar to failed dual-instance |
| **Copied volume** (green gets a fresh copy) | Complete isolation, no concurrent access | 5-10s copy time, green may miss writes during copy | **Yes** — safe and simple |
| **Shared volume with strict stop-before-start** | No copy, no concurrent access | Brief downtime while blue stops and green starts (~10s) | Acceptable fallback |

**Recommendation:** Copied volume. The 5-10 second copy is invisible to users (green is not serving traffic yet), and it completely eliminates the concurrent SQLite access risk.

#### Files to Create/Modify

| File | Change |
|------|--------|
| `docker-compose.unified.yml` | Add `omniroute-green` and `customer-portal-green` service definitions (alternate ports, green volumes) |
| `nginx/nginx.conf` | Add green upstream entries (initially `down`), parameterize active slot |
| `deploy.sh` | Rewrite deploy flow to build green → health check → swap nginx → stop blue |
| New: `scripts/blue-green-switch.sh` | Orchestrates the swap (health check, nginx reload, drain) |
| New: `scripts/rollback.sh` | Reverses the swap |

---

### Phase 2: Graceful Drain Mode (True Zero Downtime)

**Effort:** 1-2 weeks
**Downtime:** None — in-flight SSE streams complete naturally
**Risk:** Medium — requires OmniRoute code changes (submodule)

#### Strategy

Add a **drain mode** to OmniRoute:

1. **New API endpoint:** `POST /api/admin/drain` — sets a process-wide flag
2. **Behavior when draining:**
   - Health check returns non-200 (nginx stops sending new connections)
   - Existing SSE streams continue to completion
   - No new requests accepted (returns 503 with `Retry-After` header)
3. **Deploy flow becomes:**
   ```
   1. Build + start green (alternate port, copied volume)
   2. Health check green
   3. Send drain signal to blue → blue stops accepting new connections
   4. Nginx reload → new connections go to green
   5. Wait for blue's active SSE streams to finish (poll /api/admin/active-streams or wait timeout)
   6. Stop blue
   ```

#### OmniRoute Code Changes Required

| File | Change |
|------|--------|
| `src/app/api/health/route.ts` | Return 503 when draining |
| `src/app/api/admin/drain/route.ts` | New endpoint to toggle drain mode |
| `src/app/api/admin/active-streams/route.ts` | New endpoint to report active SSE count |
| `src/sse/handlers/chat.ts` | Check drain flag before accepting new requests |
| `src/lib/drainMode.ts` | New module for drain state management |

These changes would be in the OmniRoute submodule (`OmniRoute/`), requiring a fork commit + submodule pointer bump.

---

### Phase 3: Full State Externalization (Long-Term, Enables Horizontal Scaling)

**Effort:** 4-8 weeks
**Downtime:** N/A — enables canary, rolling, and auto-scaling deployments
**Risk:** High — significant architecture change to OmniRoute

This is the approach recommended in `CONNECTION_ISSUES_FIX.md:151-160` for true multi-instance support:

1. **Migrate OmniRoute from SQLite to PostgreSQL** (already have Cloud SQL)
   - Replace `better-sqlite3` with `pg` or Prisma
   - Migrate 97 schema files to PostgreSQL equivalents
   - This is the single largest effort — 83 domain modules in `src/lib/db/`

2. **Move in-memory state to Redis** (already have Memorystore)
   - Quota cache, circuit breakers, model lockouts
   - Session affinity, rate limit counters

3. **Implement leader election** for background jobs
   - Only one instance runs credential health checks, DB health checks, quota refresh
   - Use Redis-based lock or PostgreSQL advisory lock

4. **Enable sticky sessions** in nginx (for admin dashboard consistency)
   - `ip_hash` or cookie-based session affinity

Once complete, the platform can run N instances behind nginx with true horizontal scaling, canary deployments, and automatic failover. Blue-green becomes trivial — just spin up new instances and drain old ones.

---

## 7. Implementation Effort Summary

| Phase | Effort | Downtime | OmniRoute Code Changes | New Infrastructure |
|-------|--------|----------|----------------------|-------------------|
| **Phase 1:** Nginx upstream-swap | 2-3 days | Sub-second (new connections); SSE streams dropped | None | Green container slots, alternate ports |
| **Phase 2:** Graceful drain | +1-2 weeks | True zero | Drain mode feature (submodule) | Drain API endpoints |
| **Phase 3:** State externalization | +4-8 weeks | N/A (enables all strategies) | SQLite → PostgreSQL migration (major) | None (reuse Cloud SQL + Memorystore) |

---

## 8. Risk Matrix

| Risk | Probability | Impact | Phase 1 Mitigation | Phase 2+ Mitigation |
|------|------------|--------|-------------------|-------------------|
| Concurrent SQLite access during switch | Low (with copied volume) | High (state corruption) | Use copied volume, stop blue before green writes | Same |
| SSE stream truncation | Certain (during switch) | Medium (user retries) | Same as current deploy — not a regression | Drain mode eliminates this |
| Background job duplication | Low (brief overlap) | Medium (rate limits) | Stop blue before green's schedulers start | Leader election |
| Migration conflicts | Low (idempotent migrations) | Medium (lock contention) | Run migrations before starting green | Same |
| Nginx config error | Low (nginx -t gate) | High (502 for all traffic) | Config test before reload, auto-restore backup | Same |
| Resource exhaustion during overlap | Very Low | Medium (OOM) | 7 GB free RAM, 2 GB needed — verified feasible | Same |
| Volume copy corruption | Very Low | High (data loss) | Copy from mounted volume, verify file integrity | Use shared PostgreSQL instead |
| Rollback failure | Low | High (extended outage) | Keep backup images, keep blue running during drain | Same + instant rollback |

---

## 9. Recommendation

### Proceed with Phase 1 immediately.

**Rationale:**
- Eliminates the 5-15 second downtime window of the current `deploy.sh` rolling restart
- Sub-second switchover for new connections via nginx reload
- No OmniRoute code changes required (no submodule modifications)
- Low risk — uses existing Docker Compose + Nginx infrastructure
- Stays within available server resources (verified: 7 GB RAM free, 18 GB disk free)
- Directly addresses the root cause of the previous dual-instance failure by using a copied volume (no concurrent SQLite access)
- Provides instant rollback capability (keep blue running during green verification)

### Plan Phase 2 for the next quarter.

Adding drain mode to OmniRoute eliminates SSE stream truncation — the only remaining user-visible disruption. This is the difference between "near-zero downtime" and "true zero downtime."

### Evaluate Phase 3 if scaling beyond a single server.

If the platform needs to scale beyond one VPS (the README anticipates 1000+ users on e2-standard-8), SQLite-to-PostgreSQL migration becomes necessary. This is a major effort but unlocks horizontal scaling, canary deployments, and automatic failover.

---

## 10. Phase 1 Implementation Checklist

- [ ] Add `omniroute-green` and `customer-portal-green` services to `docker-compose.unified.yml` (alternate ports: 20138/20139, 3001)
- [ ] Add `ai-omniroute-data-green` and `ai-portal-data-green` volumes
- [ ] Add green upstream entries to `nginx/nginx.conf` (initially marked `down`)
- [ ] Create `scripts/blue-green-switch.sh` — orchestrates: copy volume → start green → health check → swap nginx → stop blue
- [ ] Create `scripts/blue-green-rollback.sh` — reverses the swap
- [ ] Rewrite `deploy.sh` to call the blue-green switch script instead of `roll_service_single`
- [ ] Add health check verification for green before nginx swap (abort if unhealthy)
- [ ] Add nginx config backup/restore around the swap (already patterned in `deploy.sh:309-323`)
- [ ] Test: deploy with no changes (should be no-op)
- [ ] Test: deploy with OmniRoute-only changes
- [ ] Test: deploy with portal-only changes
- [ ] Test: deploy with both changed
- [ ] Test: rollback after failed green health check
- [ ] Test: rollback after successful deploy (manual rollback)
- [ ] Update `DEPLOYMENT.md` with blue-green procedure
- [ ] Update `manage.sh status` to show both blue and green slots

---

## Appendix A: Current Container Memory Profile

| Container | Memory Usage | Memory Limit | CPU |
|-----------|-------------|-------------|-----|
| omniroute | 478 MB | 1.5 GB | 0.84% |
| customer-portal | 111 MB | 512 MB | 0.00% |
| cliproxyapi | 14 MB | 256 MB | 0.00% |
| report-deliverer | 19 MB | 256 MB | 0.00% |
| free-models-extractor | 48 MB | 256 MB | 0.00% |
| omniroute-redis | 6 MB | — | 0.63% |
| proxy_pool | 67 MB | — | 0.08% |
| proxy_pool_redis | 3 MB | — | 0.50% |
| omniroute-proxy-scraper | 14 MB | — | 0.02% |
| **Total** | **~760 MB** | **~2.8 GB** | — |

Blue-green peak adds ~590 MB actual / 2 GB limits for green `omniroute` + `customer-portal` — well within 7 GB available.

## Appendix B: Key File References

| File | Relevance |
|------|-----------|
| `deploy.sh:224-230` | Current `roll_service_single()` — the function blue-green replaces |
| `deploy.sh:175-192` | Current rollback mechanism — pattern to extend |
| `docker-compose.unified.yml:15-90` | OmniRoute base config (x-omniroute-base anchor) |
| `docker-compose.unified.yml:92-138` | Portal base config (x-portal-base anchor) |
| `nginx/nginx.conf:56-69` | Current upstream definitions — where green slots are added |
| `nginx/nginx.conf:114-129` | API proxy config (SSE streaming, 600s timeout) |
| `CONNECTION_ISSUES_FIX.md:151-160` | Previous dual-instance failure analysis |
| `OmniRoute/src/lib/db/core.ts:1336` | SQLite WAL mode + busy_timeout configuration |
| `OmniRoute/src/lib/db/core.ts:1183-1429` | `getDbInstance()` — singleton SQLite connection |
| `revert-to-single-instance.sh` | Cleanup script from previous dual-instance revert |
