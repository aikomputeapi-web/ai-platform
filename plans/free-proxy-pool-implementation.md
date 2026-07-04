# Free Proxy Pool Package — Detailed Implementation Plan

> Provides a **step-by-step build order**, the **exact content strategy** for every file, the **adapter contracts**, and a **"leave the original in place"** guarantee. Read this before writing any package file.

## 0. Non-Goals / Hard Guarantees

1. **Original OmniRoute proxy files are NOT modified, deleted, or moved.** The package lives entirely under `packages/free-proxy-pool/`. OmniRoute's `OmniRoute/src/lib/jobs/freeProxyJob.ts`, `OmniRoute/src/lib/proxyLogger.ts`, `OmniRoute/open-sse/utils/proxyFallback.ts`, `OmniRoute/src/lib/db/freeProxies.ts`, and `OmniRoute/src/lib/freeProxyProviders/*` keep running in production as-is.
2. **No npm-link / workspace registration required to be useful.** The package is consumable by path (`"@ai-platform/free-proxy-pool": "file:./packages/free-proxy-pool"`) or by copying the `dist/` folder. We will NOT add it to a pnpm/npm workspace root config in this work — that's a separate, opt-in wiring step the consumer controls.
3. **No behavioural drift.** Core logic (SQL queries, constants, thresholds, parallelization chunks, alert cooldowns) is copied **verbatim** from the OmniRoute sources so the package behaves identically when wired to a matching DB shape.

## 1. Directory & File Manifest

Everything is new files under `packages/free-proxy-pool/`:

```
packages/free-proxy-pool/
├── package.json
├── tsconfig.json
├── README.md
├── migrations/
│   └── 001_init.sql                 # free_proxies + proxy_registry + proxy_assignments schema
├── src/
│   ├── index.ts                      # public re-exports
│   ├── types.ts                      # data types: ProxyShape, FreeProxyRow, GlobalPoolRow, JobSettings
│   ├── adapters.ts                   # adapter INTERFACES (the seams)
│   ├── core/
│   │   ├── pool.ts                   # createFreeProxyPool() controller + start/stop/reload
│   │   ├── ticks.ts                  # runCheckTick + runSyncTick (verbatim port)
│   │   ├── promoteDemote.ts          # promoteProxyToGlobal + demoteTier3ToTier2 (verbatim SQL port)
│   │   ├── probe.ts                  # testProxyMultiTarget (uses ProxyProbe adapter)
│   │   └── settings.ts               # getJobSettings fallback + getSettingsHash
│   ├── fallback/
│   │   ├── findWorkingProxy.ts       # findWorkingProxy cache + probe (uses CandidateSource)
│   │   └── testSingleProxy.ts        # thin wrapper over ProxyProbe
│   ├── providers/                    # COPIED VERBATIM from OmniRoute/src/lib/freeProxyProviders
│   │   ├── types.ts
│   │   ├── index.ts
│   │   ├── iplocate.ts
│   │   ├── oneproxy.ts
│   │   ├── proxifly.ts
│   │   ├── proxypool.ts
│   │   └── proxyscraper.ts
│   └── adapters/                     # default concrete implementations
│       ├── index.ts                  # re-export all defaults
│       ├── console-logger.ts
│       ├── in-memory-settings.ts
│       ├── ring-buffer-failures.ts
│       ├── undici-probe.ts
│       └── sqlite-adapter.ts
└── tests/
    └── core.test.ts                 # smoke test using in-memory defaults
```

**File count:** 22 new files, 0 modified/deleted existing files.

## 2. Adapter Contracts (`src/adapters.ts`)

Copy from `plans/free-proxy-pool-package.md` §Adapter Interfaces, locked here as the contract:

| Identifier | Purpose | Required | OmniRoute analogue |
|---|---|---|---|
| `DbAdapter` | CRUD over free_proxies + proxy_registry + proxy_assignments | yes | the raw SQL currently inline in `freeProxyJob.ts` |
| `Logger` | structured logging (info/warn/error/debug) | yes | `createLogger("free-proxy-job")` |
| `SettingsStore` | `get(): Promise<JobSettings>` + `shouldReload()` | yes | `getSettings()` reading `freeProxy*` keys |
| `AlertSink` | `emit(alert: ProxyPoolAlert)` | yes | `dispatchEvent` for `proxy.demoted` / `proxy.pool-low` |
| `FailureFeed` | `recentFailures(windowMs): Map<string,number>` + optional `record()` | yes | `getRecentProxyFailures` |
| `ProxyProbe` | `test(proxyUrl, targetUrl, timeoutMs)` | yes | `testSingleProxy` via `createProxyDispatcher` |
| `CandidateSource` | `list(targetUrl?): Promise<string[]>` | for fallback only | `getProxyCandidates` |
| `FreeProxyProvider` | scraper plugin interface (already clean) | yes | `freeProxyProviders/types.ts` |

### JobSettings shape (single source of truth)

Matches the inferred return type of `getJobSettings()` in [`OmniRoute/src/lib/jobs/freeProxyJob.ts:140-155`](OmniRoute/src/lib/jobs/freeProxyJob.ts:140):

```ts
export interface JobSettings {
  enabled: boolean;
  checkIntervalMs: number;
  syncIntervalMs: number;
  countryFilter: string | "ALL";
  minQuality: number;
  minTests: number;
  minSuccessRate: number;
  autoElevate: boolean;
  poolSize: number;
  autoRemoveDead: boolean;
  tier1PromoteThreshold: number;
  tier2DemoteThreshold: number;
  liveFailThreshold: number;
  autoDistribute: boolean;
}
```

### DbAdapter surface

```ts
export interface FreeProxyRow {
  id: string;
  tier: 1 | 2 | 3;
  type: string;
  host: string;
  port: number;
  country_code: string | null;
  in_pool: 0 | 1;
  consecutive_successes: number;
  consecutive_failures: number;
  test_count: number;
  success_count: number;
  quality_score: number | null;
  latency_ms: number | null;
}

export interface GlobalPoolRow {
  registryId: string;
  type: string;
  host: string;
  port: number;
}

export interface PromotionCandidate {
  id: string;
  type: string;
  host: string;
  port: number;
  quality_score: number | null;
  latency_ms: number | null;
}

export interface DbAdapter {
  listTier(tier: 1 | 2 | 3, countryFilter: string | "ALL"): Promise<FreeProxyRow[]>;
  listGlobalPool(): Promise<GlobalPoolRow[]>;
  countGlobalPool(): Promise<number>;
  listPromotionCandidates(countryFilter: string | "ALL", minTests: number, minQuality: number, limit: number): Promise<PromotionCandidate[]>;
  recordTestResult(id: string, ok: boolean, latencyMs: number | null, quality: number): Promise<void>;
  setTier(id: string, tier: 1 | 2 | 3): Promise<void>;
  resetCounters(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  demoteFromGlobalPool(registryId: string, host: string): Promise<void>;
  promoteToGlobalCandidate(candidate: PromotionCandidate, country: string, poolSize: number, namePrefix: string): Promise<void>;
  deleteNonMatchingCountry(country: string): Promise<number>;
}
```

Each DbAdapter method maps 1:1 to a SQL block currently inline in `freeProxyJob.ts`. The default SQLite adapter just relocates that exact SQL — no rewrites.

## 3. Step-by-Step Build Order

Each step lists (a) file(s) to create, (b) where the source content comes from, (c) minimal transformation rules.

### Step 1 — Package config (`package.json`, `tsconfig.json`)

- `package.json`: name `@ai-platform/free-proxy-pool`, ESM (`"type": "module"`), exports `./` + `./adapters` + `./providers`, `peerDependencies` = `undici` + `better-sqlite3` (both optional), `devDependencies` for typecheck only. No bundler.
- `tsconfig.json`: `target ES2020`, `module ES2020`/`moduleResolution Bundler`, `strict`, `declaration`, `composite: false` (avoids project-references tangle), `outDir dist`, `rootDir src`.
- Source: write fresh.

### Step 2 — Types (`src/types.ts`)

- Define `ProxyShape`, `FreeProxyRow`, `GlobalPoolRow`, `PromotionCandidate`, `JobSettings`, `ProxyPoolAlert`, `Tier` literal.
- Source: extracted from `freeProxyJob.ts` rows (`CandidateRow`, the pool SELECT shapes) + the adapter contract in §2.

### Step 3 — Adapter interfaces (`src/adapters.ts`)

- Interfaces only, no logic. Copy the contract from §2 verbatim. Add JSDoc referencing the OmniRoute file/line each adapter replaces (so future maintainers can diff).

### Step 4 — Providers (verbatim copy)

- `src/providers/*.ts` ← byte-identical copy of `OmniRoute/src/lib/freeProxyProviders/*.ts` (6 files).
- **Only transformation:** none. These files already have no OmniRoute imports beyond `fetch` + the local `types.ts`. They ship as-is.
- Verify by `diff` against the originals (must be empty modulo trailing newline).

### Step 5 — Core probe (`src/core/probe.ts`)

- Port `testProxyMultiTarget` verbatim from [`freeProxyJob.ts:44-61`](OmniRoute/src/lib/jobs/freeProxyJob.ts:44).
- **Transformation:** replace the dynamic `import("@omniroute/open-sse/utils/proxyFallback")` with a call to the injected `ProxyProbe` adapter: `probe.test(proxyUrl, target, perTargetTimeoutMs)`.
- Signature: `async function testProxyMultiTarget(probe: ProxyProbe, proxyUrl: string, perTargetTimeoutMs: number, targets: string[]): Promise<{ ok: boolean; latencyMs: number | null }>`.

### Step 6 — Promote/demote (`src/core/promoteDemote.ts`)

- Port `promoteProxyToGlobal` ([`freeProxyJob.ts:243-371`](OmniRoute/src/lib/jobs/freeProxyJob.ts:243)) and `demoteTier3ToTier2` ([`freeProxyJob.ts:373-391`]( OmniRoute/src/lib/jobs/freeProxyJob.ts:373)).
- **Transformation:** each `db.prepare(...).run(...)` becomes a DbAdapter method call. The SQL string stays the same — it moves INTO the `SqliteAdapter` implementation. The core file no longer imports `getDbInstance` or `randomUUID`; UUID generation is done inside the adapter (DbAdapter.promoteToGlobalCandidate owns the `randomUUID()` call).
- `distributeProxiesToAccounts` is NOT ported — it depends on `@/lib/db/providers` and `@/lib/proxyEgress` which are OmniRoute account-management concerns. It becomes an **optional injected hook** `distribute?: () => Promise<void>` on the pool controller; if absent, the sync tick logs "auto-distribute skipped (no hook)".

### Step 7 — Settings (`src/core/settings.ts`)

- Port `getJobSettings` ([`freeProxyJob.ts:99-175`](OmniRoute/src/lib/jobs/freeProxyJob.ts:99)) + `getSettingsHash` ([`:177-179`](OmniRoute/src/lib/jobs/freeProxyJob.ts:177)).
- **Transformation:** `getJobSettings` becomes a **fallback default** used only when the injected `SettingsStore` throws. It reads a plain options object passed to the factory; the DEFAULT constants (`checkIntervalMs: 10min`, `syncIntervalMs: 30min`, `liveFailThreshold: 3`, etc.) match the catch-block return in `freeProxyJob.ts:158-173`. The `SettingsStore` adapter is the source of truth at runtime; this fallback is for tests/zero-config.
- `getSettingsHash` ported verbatim.

### Step 8 — Ticks (`src/core/ticks.ts`)

- Port `runFreeProxyCheckTick` ([`freeProxyJob.ts:475-755`](OmniRoute/src/lib/jobs/freeProxyJob.ts:475)) and `runFreeProxySyncTick` ([`:761-872`](OmniRoute/src/lib/jobs/freeProxyJob.ts:761)) **verbatim** in structure.
- **Transformations:**
  - `getRecentProxyFailures(LIVE_FAIL_WINDOW_MS)` → `failures.recentFailures(LIVE_FAIL_WINDOW_MS)`.
  - `getDbInstance()` + `db.prepare(...)` → `db.listTier(...)`, `db.listGlobalPool()`, `db.countGlobalPool()`, etc.
  - `demoteTier3ToTier2(...)` / `promoteProxyToGlobal(...)` → use the local `promoteDemote.ts` functions (which themselves now take `db: DbAdapter`).
  - `emitProxyAlert("proxy.demoted", {...})` → `alerts.emit({ type: "proxy.demoted", ... })`.
  - `testProxyMultiTarget(url, 5000)` → `testProxyMultiTarget(probe, url, 5000, testTargets)`.
  - `distributeProxiesToAccounts()` → `options.distribute?.()` guarded by `settings.autoDistribute`.
  - `syncFreeProxySources()` → iterate `options.providers`, call `.sync()` on each. Same loop + identical logging shape.
  - The `import("@/lib/db/freeProxies")` lazy loads become direct calls on `db` adapter + the injected `log`. No lazy `require`.
- **Constants** ported verbatim into a local `constants` const block at the top of `ticks.ts`: `DEFAULT_LIVE_FAIL_THRESHOLD = 3`, `LIVE_FAIL_WINDOW_MS = 5*60*1000`, `LOW_POOL_THRESHOLD = 3`, `LOW_POOL_ALERT_COOLDOWN_MS = 15*60*1000`, `lastLowPoolAlertAt` (module-level mutable — same pattern as the original).

### Step 9 — Controller (`src/core/pool.ts`)

- `createFreeProxyPool(options)` factory + the returned controller.
- Mirrors `startFreeProxyJob`/`stopFreeProxyJob`/`reloadFreeProxyJob` from [`freeProxyJob.ts:881-951`](OmniRoute/src/lib/jobs/freeProxyJob.ts:881):
  - `isCheckTickRunning`/`isSyncTickRunning` overlap guards with `try/finally` (already verified in current file).
  - `reloadInFlight` singleflight guard.
  - `checkTimer`/`syncTimer` with `.unref()`.
  - `currentSettingsHash` change detection.
- Internal `getJobSettings()` resolution prefers `options.settings.get()`, falls back to `core/settings.ts` defaults on throw.
- Public methods: `start()`, `stop()`, `reload()`, `runCheckTick()`, `runSyncTick()`, plus `findWorkingProxy(targetHostname, targetUrl)` delegating to `fallback/findWorkingProxy.ts` if a `CandidateSource` was provided.

### Step 10 — Fallback (`src/fallback/*`)

- `testSingleProxy.ts`: `createTestSingleProxy(probe: ProxyProbe)` returning the original `testSingleProxy` signature — pure delegation (keeps the probe adapter swappable).
- `findWorkingProxy.ts`: port `findWorkingProxy` from [`proxyFallback.ts:289-341`](OmniRoute/open-sse/utils/proxyFallback.ts:289) verbatim:
  - `PROXY_FALLBACK_CACHE: Map<string, CacheEntry>` (module-level).
  - `CACHE_TTL_MS = 5*60*1000`, `NEGATIVE_CACHE_TTL_MS = 45*1000` (same constants we just fixed).
  - Candidate collection → `candidateSource.list(targetUrl)` (injected). The in-package default candidate source returns `[]` (host must supply its own address book, like OmniRoute's `getProxyCandidates`).
  - `clearProxyFallbackCache()` export for tests/admin (verbatim).

### Step 11 — Default adapters (`src/adapters/*`)

| File | Implementation notes |
|---|---|
| `console-logger.ts` | `Logger` → `console` wrapper. Level filter via ctor arg. No deps. |
| `in-memory-settings.ts` | `SettingsStore` backed by a mutable `JobSettings` object; `get()` returns a clone; `set()` updates; `shouldReload()` compares the hash from core/settings. |
| `ring-buffer-failures.ts` | `FailureFeed` with a capped array (default 200, matching `MAX_IN_MEMORY_ENTRIES` in `proxyLogger.ts:14`). `recentFailures(windowMs)` aggregates error/timeout entries; `record()` appends. No SQLite (host wires its own persistent feed if needed). |
| `undici-probe.ts` | `ProxyProbe` using `undici`'s `ProxyAgent` + `fetch` (HEAD, 3s default). Optional peer dep — import is dynamic so the package loads even without `undici` installed. |
| `sqlite-adapter.ts` | `DbAdapter` backed by a `better-sqlite3`-compatible db handle (`{ prepare, exec, transaction }`). Each method runs the **exact** SQL string currently inline in `freeProxyJob.ts`. Includes a `migrate(db)` helper that runs `migrations/001_init.sql`. |

### Step 12 — Migrations (`migrations/001_init.sql`)

- Document the 3 tables (`free_proxies`, `proxy_registry`, `proxy_assignments`) with the columns the SQL in `freeProxyJob.ts` assumes. Pull column lists from the SELECT/INSERT statements in `freeProxyJob.ts` + `db/freeProxies.ts` (do NOT assume any existing migration file exists in OmniRoute — the schema may live in a `db/init.ts` we haven't audited; the package owns its own copy of the schema for greenfield consumers).
- `IF NOT EXISTS` on every CREATE so it's idempotent against an existing OmniRoute DB (safe to run on the same SQLite file — it won't clobber existing tables/columns).

### Step 13 — Public API (`src/index.ts`)

- Re-export `createFreeProxyPool` + `FreeProxyPool` type from `core/pool.ts`.
- Re-export all adapter interfaces from `adapters.ts`.
- Re-export `types.ts`.
- `export * from "./providers"` under a subpath.

### Step 14 — `README.md`

- Quickstart (5 lines, using defaults).
- Adapter reference table.
- Migration instructions.
- A "Porting from OmniRoute" section listing exactly which OmniRoute files each adapter wraps + line refs.
- Note that OmniRoute itself is unchanged; wiring it to consume this package is a separate opt-in task.

### Step 15 — Tests (`tests/core.test.ts`)

- Smoke test: instantiate `createFreeProxyPool` with all default adapters + a 1s `checkIntervalMs`, start, run one check tick (no proxies in the in-memory sqlite), stop, assert no throws.
- Marked as a manual test script (no test runner added — keeps the package dep-free); documented to run via `node --experimental-strip-types tests/core.test.ts` or after `npm run build` via `node dist-tests/...`.

## 4. Verbatim-vs-Transformed Map

| OmniRoute source region | Destination | Verbatim? |
|---|---|---|
| `freeProxyProviders/*.ts` (6 files) | `src/providers/*` | **Verbatim** |
| `freeProxyJob.ts:44-61` `testProxyMultiTarget` | `src/core/probe.ts` | Verbatim structure; dispatcher import → `probe` arg |
| `freeProxyJob.ts:99-175` `getJobSettings` | `src/core/settings.ts` | Defaults verbatim; uses SettingsStore adapter |
| `freeProxyJob.ts:177-179` `getSettingsHash` | `src/core/settings.ts` | Verbatim |
| `freeProxyJob.ts:243-371` `promoteProxyToGlobal` | `src/core/promoteDemote.ts` | SQL verbatim, relocated to adapter; core calls adapter |
| `freeProxyJob.ts:373-391` `demoteTier3ToTier2` | `src/core/promoteDemote.ts` | SQL verbatim, relocated to adapter |
| `freeProxyJob.ts:475-755` `runFreeProxyCheckTick` | `src/core/ticks.ts` | Verbatim logic; `getDbInstance`→`db`, `emitProxyAlert`→`alerts.emit`, `getRecentProxyFailures`→`failures.recentFailures`, `testProxyMultiTarget` calls gain `(probe, ..., targets)` args |
| `freeProxyJob.ts:761-872` `runFreeProxySyncTick` | `src/core/ticks.ts` | Same transforms; `distributeProxiesToAccounts`→`options.distribute?.()` |
| `freeProxyJob.ts:881-951` `reload`/`start`/`stop` | `src/core/pool.ts` | Verbatim guards (singleflight, overlap, try/finally, `.unref()`) |
| `proxyFallback.ts:289-341` `findWorkingProxy` + cache | `src/fallback/findWorkingProxy.ts` | Verbatim; candidate source injected |
| `proxyFallback.ts:217-246` `testSingleProxy` | `src/fallback/testSingleProxy.ts` | Delegates to `ProxyProbe` adapter |
| `proxyFallback.ts:69-125` `resolveEnvProxyUrl` | `src/adapters/env-candidate-source.ts` (bonus) | Verbatim (no OmniRoute deps) |
| `freeProxyJob.ts:399-469` `distributeProxiesToAccounts` | **NOT PORTED** (injected hook) | OmniRoute-only |

## 5. Coupling Risks & Mitigations

1. **`randomUUID()`** — currently used inline in `promoteProxyToGlobal`. Move into `SqliteAdapter.promoteToGlobalCandidate` so the core has zero `crypto` import. (In-memory adapter can use `crypto.randomUUID` since it's stdlib.)
2. **`createLogger`** — replace with injected `Logger`. Default `console-logger.ts` ships.
3. **`getEnabledProviders()` / `syncFreeProxySources()`** — providers are injected as an array (`FreeProxyProvider[]`); the sync loop calls `.sync()` on each. Same logging.
4. **`validateProxyPool()` (from `proxyEgress`)** — called in `runFreeProxyCheckTick` for registry status tracking. Make it an **optional injected hook** `validatePool?: () => Promise<{alive:number;dead:number}>`; if absent, skip that block. Avoids dragging `proxyEgress` into the package.
5. **`getRecentProxyFailures` ring buffer** — provided by `FailureFeed` adapter; default `ring-buffer-failures.ts` is a from-scratch in-memory reimplementation matching `proxyLogger.ts:259-270` semantics (skip success entries, window cutoff, `host:port` keying).
6. **Webhook `WebhookEvent` union** — NOT imported by the package. `AlertSink.emit` takes a `ProxyPoolAlert` discriminated union (the package's own); the OmniRoute wiring adapter translates `ProxyPoolAlert` → `dispatchEvent(event.type, payload)`.

## 6. Validation Checklist

After building, verify:

- [ ] `cd packages/free-proxy-pool && npm install && npm run typecheck` exits 0.
- [ ] `diff -r src/providers ../../../OmniRoute/src/lib/freeProxyProviders` (modulo file rename) is empty.
- [ ] `grep -rn "getDbInstance\|createLogger\|@/lib\|@omniroute\|@/shared" src/` returns zero hits — the package has no internal OmniRoute path aliases.
- [ ] `grep -rn "freeProxy" src/core/ticks.ts` shows only the constant names, not `settings.freeProxy*` DB-key access (the adapter owns settings reading).
- [ ] Smoke-test: `node -e "import('./dist/index.js').then(async m => { const p = m.createFreeProxyPool(m.defaultAdapters()); p.start(); await new Promise(r=>setTimeout(r,200)); p.stop(); console.log('ok'); })"` prints `ok` with no output beyond startup logs.
- [ ] Original OmniRoute proxy files are byte-identical to their pre-work state: `git status OmniRoute/` shows nothing modified under `OmniRoute/src/lib/jobs/freeProxyJob.ts`, `OmniRoute/src/lib/proxyLogger.ts`, `OmniRoute/open-sse/utils/proxyFallback.ts`, `OmniRoute/src/lib/db/freeProxies.ts`, `OmniRoute/src/lib/freeProxyProviders/`.

## 7. Out of Scope (explicitly deferred)

- Adding the package to a monorepo workspace config (pnpm-workspace.yaml / npm workspaces) — left to the consumer.
- Rewiring `OmniRoute/src/lib/jobs/freeProxyJob.ts` to consume the package — deferred; described in `plans/free-proxy-pool-package.md` §"OmniRoute Integration" but not executed.
- CI / publish to npm registry — deferred.
- Performance benchmarks — deferred (behaviour is byte-identical to current code).

## 8. Build Order Summary (todo list the code session will follow)

1. `package.json` + `tsconfig.json`
2. `src/types.ts`
3. `src/adapters.ts`
4. `src/providers/*` (verbatim copy)
5. `src/core/probe.ts`
6. `src/core/settings.ts`
7. `src/core/promoteDemote.ts`
8. `src/core/ticks.ts`
9. `src/core/pool.ts`
10. `src/fallback/testSingleProxy.ts` + `src/fallback/findWorkingProxy.ts`
11. `src/adapters/console-logger.ts`
12. `src/adapters/in-memory-settings.ts`
13. `src/adapters/ring-buffer-failures.ts`
14. `src/adapters/undici-probe.ts`
15. `src/adapters/sqlite-adapter.ts`
16. `migrations/001_init.sql`
17. `src/adapters/index.ts` (default bundle) + `src/index.ts`
18. `README.md`
19. `tests/core.test.ts`
20. Run `npm run typecheck`; fix any drift; re-check the §6 checklist.
