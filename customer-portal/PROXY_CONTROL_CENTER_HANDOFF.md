# Proxy Control Center Handoff

Date: 2026-07-04 (updated — OmniRoute backend implemented)

## Errors and risks found

- The reported free/proxy pool checkbox issue could not be traced to checked-in UI source. The only source-controlled admin infrastructure UI was under `customer-portal/src/app/admin/infrastructure/`.
- The reusable proxy package has different row identifiers by tier: free/candidate rows use `id`, while global pool rows use `registryId`. A UI keyed only on `id`, or one that conditionally renders checkbox columns only for free-pool rows, will fail selection for Tier 3/global rows.
- The admin operations API can return `health: null` when OmniRoute health fetch fails, while operations/routing UI types assumed a non-null object.
- The admin settings API exposed `emailDotShadowban`, but the settings UI did not type or render it.
- Maintenance mode defaulted to enabled when the DB row was absent (`enabled !== false`), which is risky for a global operator setting.
- **(new)** The customer portal does NOT depend on `@ai-platform/free-proxy-pool` (see `customer-portal/package.json`). The package declares `better-sqlite3` + `undici` as optional peer-dependencies that the portal does not install and ships only a built `dist/`. Importing the package directly into the portal would pull in adapters the portal never loads and would also couple the portal to the proxy pool's SQLite file. The package's own design doc (`plans/free-proxy-pool-package.md` §"OmniRoute Integration") explicitly states OmniRoute is NOT modified, and wiring it to consume the package is a separate opt-in task. Until that wiring lands, the single source of truth for proxy pool state remains OmniRoute's DB. Therefore the thinnest stable bridge is the existing `omnirouteFetch` server-side client (`src/lib/omniroute.ts`), already used by the operations/routing/catalog admin APIs. See `src/lib/proxy-control-bridge.ts` for the documented rationale.
- **(new)** `#proxy-tool-reuseable/README.md` line 3 contains corrupted content (`P…ASXXXAXZAZ…ortable`). It was NOT modified by this task (out of scope). Recommend a separate cleanup.

## Changes made

- Added `customer-portal/src/app/admin/infrastructure/proxy-control-tab.tsx` as a source-controlled Proxy Control Center.
- Wired the new `proxy` tab into `customer-portal/src/app/admin/infrastructure/page.tsx`.
- Implemented three tier tabs:
  - Tier 1 Intake / Free Pool
  - Tier 2 Verified Candidates
  - Tier 3 Active Global Proxy Pool
- Implemented one shared table selection flow for all tiers using a normalized `selectionKey`, preserving tier-specific `id`/`registryId` as `sourceId` metadata.
- Rendered checkbox columns unconditionally for every tier, including the global pool tab.
- Added a clearer proxy settings panel for:
  - job enabled
  - check/sync interval
  - country filter
  - quality thresholds
  - pool size
  - provider toggles
  - manual actions
- Made operations/routing health rendering null-safe around `health`.
- Added `emailDotShadowban` to the admin settings UI and save flow.
- Changed maintenance mode API default/patch interpretation to require explicit `enabled === true`.

### New in this iteration (backend + live UI wiring)

- **Shared DTO** — `customer-portal/src/lib/proxy-control.ts`
  - Exports the typed `ProxyControlSnapshot`, `ProxyPoolRow`, `ProxySettings`, `ProxyManualAction`, `ProxyActionRequest`, `ProxyActionResult`, `ProxyControlSource` contract.
  - Aligned to `JobSettings` from `proxy-tool-reuseable/src/types.ts` (minute↔ms helpers `settingsToJobSettingsMs` / `jobSettingsMsToMinutes`). The portal deliberately does NOT import the package; field names are mirrored by hand and documented inline.
  - `DEFAULT_PROXY_SETTINGS` mirrors the package's `DEFAULT_JOB_SETTINGS` defaults plus the provider toggle map.
  - `buildSelectionKey(tier, sourceId)` is the single place the `${tier}:${sourceId}` contract is derived, shared by the API and UI layers.
  - `emptyProxyControlSnapshot()` produces the honest empty state used on transport failure / endpoint absence.

- **OmniRoute bridge** — `customer-portal/src/lib/proxy-control-bridge.ts`
  - `fetchProxyControlSnapshot()` GETs `/api/admin/proxy-control` on the OmniRoute side and normalizes the response into `ProxyControlSnapshot`. Degrades to an `unavailable` snapshot on any transport failure or non-2xx so the UI never renders mock rows.
  - `patchProxyControlSettings(patch)` PATCHes `/api/admin/proxy-control/settings` and returns the fresh snapshot on success.
  - `postProxyControlAction({ action, selectionKeys, actor })` POSTs `/api/admin/proxy-control/actions`.
  - Defensive normalizers coerce partial / malformed / camelCase-or-snake_case OmniRoute payloads into typed rows (Tier 1/2 → `FreeProxyRow.id`; Tier 3 → `GlobalPoolRow.registryId`).

- **Customer-portal proxy admin APIs** (admin-auth-gated, mirror existing `admin/*` convention):
  - `customer-portal/src/app/api/admin/proxy-control/route.ts` — `GET` returns the normalized snapshot; `POST` is a signpost to the canonical actions/settings routes.
  - `customer-portal/src/app/api/admin/proxy-control/settings/route.ts` — `PATCH` validates the partial `ProxySettings`/provider map and forwards via the bridge; records `proxy-control.settings.update` audit action.
  - `customer-portal/src/app/api/admin/proxy-control/actions/route.ts` — `POST` validates the action allow-list (`promote`, `demote`, `quarantine`, `remove`, `run-check`, `run-sync`) and the `selectionKeys[]` shape, forwards via the bridge, records `proxy-control.action.<verb>` audit action. `run-check`/`run-sync` permit an empty selection (global tick).

- **Live Proxy Control Center UI** — `customer-portal/src/app/admin/infrastructure/proxy-control-tab.tsx`
  - Removed all `MOCK_ROWS` and the draft-only `DEFAULT_SETTINGS` local constants in favor of the shared `@/lib/proxy-control` DTO.
  - Fetches `/api/admin/proxy-control` on mount and on every manual refresh / action / settings save (mirrors the operations/routing refresh pattern).
  - Adopts server-reported settings into local state; a guard prunes selection keys that no longer exist after a refresh so stale `tier:sourceId` pairs are never sent to the actions endpoint.
  - Save Proxy Settings → `PATCH /api/admin/proxy-control/settings` with inline success/error message.
  - Manual Actions → `POST /api/admin/proxy-control/actions` (promote / demote / quarantine / remove). Buttons are enabled only when selection is non-empty and no action is in-flight.
  - Run Check Tick / Run Sync → `POST /api/admin/proxy-control/actions` with `run-check` / `run-sync` and an empty selection.
  - The normalized `selectionKey` model and unconditional checkbox columns across all three tiers are preserved verbatim (`ProxyTierTable` unchanged in contract).
  - Backend State stat card now reports `Live` (`OmniRoute (live)`) vs `Unavailable` (`Source unavailable`) driven by `snapshot.source` instead of a hardcoded `Mock` label.

## Validation run

- `npm run lint` in `customer-portal/`: **0 errors, 31 warnings**. All 31 warnings are pre-existing and in files touched by no prior proxy-control task (`billing`, `changelog`, `docs`, `layout`, `privacy`, `AdminAccountsDashboard`, `nextauth`, `webhooks/stripe`, etc.). No warnings reference any `proxy-control` file.
- `npx tsc --noEmit` in `customer-portal/`: **clean** (exit 0, no errors).
- `npm run build` in `customer-portal/`: **success** (exit 0). The three new routes are registered as dynamic server-rendered endpoints:
  - `ƒ /api/admin/proxy-control`
  - `ƒ /api/admin/proxy-control/actions`
  - `ƒ /api/admin/proxy-control/settings`

## Wire contract for the OmniRoute side (implements the reusable proxy package persistence/service layer)

The customer portal expects the OmniRoute internal service to expose the following endpoints at `${OMNIROUTE_INTERNAL_URL}` (already reachable via `omnirouteFetch`).

### `GET /api/admin/proxy-control` → `ProxyControlSnapshot`
```
{
  tiers: {
    tier1: FreeProxyRow[],   // tier=1, in_pool=0
    tier2: FreeProxyRow[],   // tier=2, in_pool=0
    tier3: GlobalPoolRow[]   // proxy_registry joined with proxy_assignments scope='global'
  },
  settings: JobSettings,           // ms intervals; portal coerces to minutes
  source: "omniroute" | "unavailable",
  globalPoolCount: number,
  counts: { tier1, tier2, tier3 },
  lastSyncedAt: string | null
}
```
Field names mirror `proxy-tool-reuseable/src/types.ts`:
- Tier 1/2 rows use `id`, `tier`, `type`, `host`, `port`, `country_code`, `in_pool`, `consecutive_*`, `test_count`, `success_count`, `quality_score`, `latency_ms`, `last_validated`.
- Tier 3 rows use `registryId`, `type`, `host`, `port` (plus optional `region`, `quality_score`, `updated_at`).
- Settings use `JobSettings` keys (camelCase), with `checkIntervalMs` / `syncIntervalMs` in milliseconds.

### `PATCH /api/admin/proxy-control/settings` → `ProxyControlSnapshot`
Accepts a partial `ProxySettings` (minute fields `checkIntervalMinutes` / `syncIntervalMinutes`) plus the `providers` map and optional `actor`. Returns the updated snapshot. The OmniRoute side is responsible for persisting via its `SettingsStore` (which the package abstracts from `getSettings()` reading `freeProxy*` keys per `plans/free-proxy-pool-package.md`).

### `POST /api/admin/proxy-control/actions` → `ProxyActionResult`
```
Request:  { action: "promote"|"demote"|"quarantine"|"remove"|"run-check"|"run-sync",
            selectionKeys: string[],   // each `${tier}:${sourceId}`
            actor?: string }
Response: { success: boolean, action, applied: number, skipped: number,
            errors: Array<{ selectionKey, error }> }
```
Expected mapping onto the reusable package APIs (see `proxy-tool-reuseable/src/core/promoteDemote.ts` + `DbAdapter`):
- `promote` → for Tier 2 selections: `db.listPromotionCandidates` filtering then `promoteProxyToGlobal(db, log, candidate, country, poolSize, namePrefix)`.
- `demote` → for Tier 3 selections: `demoteTier3ToTier2(db, log, registryId, host)`.
- `quarantine` → best-effort: `db.resetCounters(id)` and/or a tier move; the package has no dedicated quarantine, so this is expected to be best-effort on the OmniRoute side.
- `remove` → for Tier 1/2 selections: `db.delete(id)`.
- `run-check` → `pool.runCheckTick()` (empty selection = global tick).
- `run-sync` → `pool.runSyncTick()` (empty selection = global tick).

## OmniRoute backend — IMPLEMENTED (this iteration)

### Decision: native OmniRoute infrastructure as the single source of truth

OmniRoute already owns a complete, live free-proxy layer that runs a background scheduler against its own SQLite file (`DATA_DIR/storage.sqlite`) and hot-reloads `freeProxy*` settings via `applyRuntimeSettings`. Importing `@ai-platform/free-proxy-pool` (`createFreeProxyPool` + `createSqliteAdapter`) on the OmniRoute side was rejected because it would:

- duplicate the schema already managed by OmniRoute's migrations,
- diverge from the running scheduler (`freeProxyJob.ts`), and
- require a second DB adapter against the same file.

The package's `DbAdapter` methods (`listTier`, `listGlobalPool`, `countGlobalPool`, `recordTestResult`, `setTier`, `delete`, `demoteFromGlobalPool`, `promoteToGlobalCandidate`) map 1:1 to OmniRoute's existing native helpers in `src/lib/db/freeProxies.ts` + `src/lib/db/proxies.ts`, so the endpoints were implemented as a thin bridge against the live schema (`migrations/001_init.sql`). This is the "minimal stable backend bridge against the SQLite schema" fallback documented in the original instructions.

### Files created in OmniRoute

- `OmniRoute/src/lib/api/proxyControlService.ts` — the contract implementation:
  - `buildProxyControlSnapshot()` reads Tier 1/2 via `listFreeProxiesByTier(1|2)`, Tier 3 via a direct SQL join of `proxy_registry` + `proxy_assignments` (`scope='global' AND scope_id LIKE '__global__%'`), settings via `jobSettingsFromRaw` reading `freeProxy*` keys, and provider toggles via `resolveProviderToggles` (env-derived `FREE_PROXY_<PROVIDER>_ENABLED` overlaid with the persisted `freeProxyProviderToggles` store). Returns `source: "omniroute"`.
  - `applyProxyControlSettings(patch, _actor)` maps minute fields to `freeProxyCheckIntervalMin` / `freeProxySyncIntervalMin`, persists provider toggles under `freeProxyProviderToggles`, validates against a `KNOWN_SETTINGS_PATCH_KEYS` allow-list (400 on unknown), and persists the whitelisted subset (`FREE_PROXY_SETTING_KEYS`) via `updateSettings` which hot-reloads the running job.
  - `dispatchProxyControlAction(input)` handles `promote` / `demote` / `quarantine` / `remove` / `run-check` / `run-sync`; returns `{ success, action, applied, skipped, errors }` (HTTP 200 on success, 207 when per-selection errors occurred). `run-check` / `run-sync` accept an empty selection (global tick) and fire-and-forget.
  - `demoteTier3ToTier2(registryId)` is implemented directly against the schema in a single transaction (DELETE from `proxy_assignments` + `proxy_registry`, UPDATE `free_proxies` to tier=2) for the demote-to-tier-2 contract. The remove-Tier-3 path delegates to `demoteTier3ToTier1` which is now exported from `freeProxyJob.ts`.
  - `promoteTier2ToGlobal(freeProxyId)` uses the atomic `promoteFreeProxyToPool` helper.
  - `runFreeProxyTick("run-check")` dynamically imports the exported `runFreeProxyCheckTick`; `runFreeProxyTick("run-sync")` dynamically imports the exported `runFreeProxySyncTick`. Both are now public exports from `freeProxyJob.ts`, so the service delegates to the single implementation.
- `OmniRoute/src/app/api/admin/proxy-control/route.ts` — `GET` returns the snapshot (auth via `requireManagementAuth`).
- `OmniRoute/src/app/api/admin/proxy-control/settings/route.ts` — `GET` returns the `settings` block; `PATCH` applies + returns a fresh snapshot (400 on non-object body, status taken from the service error's `.status`).
- `OmniRoute/src/app/api/admin/proxy-control/actions/route.ts` — `POST` dispatches actions (200 / 207).
- `OmniRoute/tests/unit/api/proxy-control-service.test.ts` — `node:test` suite with 9 cases. A `dbAvailable` probe + `requireDb(t)` guard skip the 6 DB-dependent tests when migrations fail; the root cause is a **pre-existing migration version collision** (`100`, `101`, `104` each have two files sharing a prefix) that blocks `getDbInstance()` entirely. This blocks all DB-dependent tests repo-wide (not proxy-control-specific). Non-DB tests (settings validation / unknown action rejection) run unconditionally and pass.

### Validation results (2026-07-04 final verification)

- **OmniRoute eslint** on the 5 proxy-control files: **0 errors** (exit 0).
- **OmniRoute `tsc --noEmit`** (typecheck-core): 0 proxy-control-specific errors. The full workspace has ~70 pre-existing errors (unrelated: `apiKeys.ts` import conflicts, `migrationRunner.ts` import conflicts, missing optional modules `js-tiktoken`/`safe-regex`, `freeProxyJob.ts:739` pre-existing `quality` scoping bug). None reference any `proxy-control` or `proxyControl` identifier.
- **OmniRoute import sanity check**: `proxyControlService.ts` exports `buildProxyControlSnapshot`, `applyProxyControlSettings`, `dispatchProxyControlAction` — all three resolve correctly under `--import tsx`.
- **OmniRoute tests** (`tests/unit/api/proxy-control-service.test.ts`): **3 pass, 0 fail, 6 skipped** (exit 0). All 6 skips are due to a pre-existing migration-number collision (`100_cli_access_tokens.sql`/`100_daily_usage_summary_api_keys.sql`, `101_*` pair, `104_*` pair) that blocks `getDbInstance()` repo-wide. CI with resolved migrations would run all 9.
- **Customer-portal `tsc --noEmit`**: clean (exit 0, no errors).
- **Customer-portal `eslint`** on all proxy-control files: **0 errors** (exit 0).
- **Customer-portal `npm run build`** (previous iteration): exit 0; the three `/api/admin/proxy-control*` routes register as dynamic endpoints.

### Endpoint contract parity

The OmniRoute endpoints return exactly the snapshot/settings/actions shapes documented in the "Wire contract" sections above — camelCase `JobSettings` with `checkIntervalMs` / `syncIntervalMs`, Tier 1/2 rows keyed by `id`, Tier 3 rows keyed by `registryId`, selection keys `${tier}:${sourceId}`, and `source: "omniroute"`. The customer-portal normalizers in `proxy-control-bridge.ts` were already tolerant of both camelCase and snake_case, so no portal changes were required. **501 responses** are returned for any action string not in the allow-list via `newUnsupportedError`.

## Unfinished work / next agent

- **Pre-existing `quality` variable scoping bug** in [`freeProxyJob.ts:739`](OmniRoute/src/lib/jobs/freeProxyJob.ts:739): the failure branch references `quality` which is scoped only to the success branch (`Cannot find name 'quality'` at tsc). This is a latent runtime bug in the success/failure branching introduced by the "3-tier system" commit; the proxy-control service does not touch this code.
- **Migration version collision**: [`src/lib/db/migrations/`](OmniRoute/src/lib/db/migrations/) has pairs of `100_*`, `101_*`, and `104_*` files. The `migrationRunner.ts` rejects this, which blocks all DB-dependent tests repo-wide. Fix: rename one file in each colliding pair to a unique version and add a retroactive guard in `isSchemaAlreadyApplied` for DBs that already applied the old number. See [`POST-MERGE-AUDIT.md`](OmniRoute/_tasks/features-v3.8.4/9route/POST-MERGE-AUDIT.md) if available.
- **Scheduler provider toggles** — the persisted `freeProxyProviderToggles` is now honoured live by the provider `isEnabled()` path via `runtimeSettings.ts` (pushes `setPersistedProviderToggles` into the provider module cache before job reload). No further wiring is needed unless a provider is added.
- **Job helpers** — `demoteTier3ToTier1`, `runFreeProxyCheckTick`, `runFreeProxySyncTick`, and `reloadFreeProxyJob` are all exported from `freeProxyJob.ts`; the service delegates to them. No further export action needed.
- Consider moving proxy settings into a typed shared DTO package published literally (publish `@ai-platform/free-proxy-pool` + add it as a customer-portal dependency) once the peer-dependency install is acceptable.
- Fix the corrupted [`proxy-tool-reuseable/README.md`](proxy-tool-reuseable/README.md) line 3 separately (out of scope here).
- Review the 31 pre-existing customer-portal lint warnings separately; none were introduced by this task.
- Add admin-side E2E coverage for the Proxy Control Center tab (refresh → live data → settings save → action submit) now that OmniRoute returns live data; the Playwright suite under `customer-portal/e2e/` currently does not cover the admin infrastructure pages.
