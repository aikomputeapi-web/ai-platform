/**
 * OmniRoute proxy-control bridge — server-side only.
 *
 * This is the thinnest stable bridge between the customer-portal proxy admin
 * API and the service that owns proxy pool persistence: OmniRoute's SQLite
 * `free_proxies` / `proxy_registry` / `proxy_assignments` tables, driven by
 * the reusable proxy package (`@ai-platform/free-proxy-pool`) when wired.
 *
 * Why a bridge instead of importing the package directly:
 *  - The customer portal does NOT depend on `@ai-platform/free-proxy-pool`
 *    (see `customer-portal/package.json`); the package declares
 *    `better-sqlite3` + `undici` as optional peer-dependencies that the portal
 *    does not install, and it ships only a built `dist/`.
 *  - The package's own design doc (`plans/free-proxy-pool-package.md` §"OmniRoute
 *    Integration") explicitly states OmniRoute is NOT modified, and wiring it
 *    to consume the package is a separate opt-in task. Until that wiring lands,
 *    single source of truth for proxy pool state remains OmniRoute's DB.
 *  - The portal already bridges all OmniRoute admin reads (operations, routing,
 *    catalog) via `omnirouteFetch` in `src/lib/omniroute.ts`, so proxy-control
 *    reuses the same authenticated server-side path.
 *
 * OmniRoute endpoint contract (expected, the OmniRoute side may not ship yet):
 *   GET  /api/admin/proxy-control                → ProxyControlSnapshotDoc
 *   PATCH /api/admin/proxy-control/settings      → ProxyControlSnapshotDoc
 *   POST /api/admin/proxy-control/actions        → ProxyActionResultDoc
 *
 * When the OmniRoute endpoint is absent, every call degrades gracefully to an
 * `unavailable` snapshot so the UI renders an honest empty state instead of
 * mock data. This matches the behavior of the operations/routing admin APIs,
 * which also degrade on OmniRoute errors.
 *
 * The wire shape produced by OmniRoute is expected to mirror the reusable
 * package row types (`FreeProxyRow` for tier 1/2, `GlobalPoolRow` for tier 3)
 * plus the `JobSettings` field names. The normalizers below coerce partial /
 * malformed payloads into typed rows defensively.
 */

import { omnirouteFetch } from './omniroute';
import {
  DEFAULT_PROXY_SETTINGS,
  buildSelectionKey,
  emptyProxyControlSnapshot,
  jobSettingsMsToMinutes,
  type ProxyControlSnapshot,
  type ProxyPoolRow,
  type ProxyPoolRowStatus,
  type ProxySettings,
  type ProxyTier,
} from './proxy-control';

const PROXY_CONTROL_PATH = '/api/admin/proxy-control';
const SETTINGS_PATH = '/api/admin/proxy-control/settings';
const ACTIONS_PATH = '/api/admin/proxy-control/actions';

export interface ProxyControlBridgeError {
  status: number;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function asNullableString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

function tierToProxyTier(tier: unknown): ProxyTier {
  if (tier === 2) return 'tier2';
  if (tier === 3) return 'tier3';
  return 'tier1';
}

function deriveStatus(
  tier: ProxyTier,
  inPool: boolean,
  qualityScore: number | null,
  minQuality: number,
): ProxyPoolRowStatus {
  if (inPool) return 'active';
  if (tier === 'tier2') return 'candidate';
  if (typeof qualityScore === 'number' && qualityScore >= minQuality) return 'candidate';
  return 'intake';
}

function successRateFor(row: {
  test_count?: unknown;
  success_count?: unknown;
}): number | null {
  const tests = asNumber(row.test_count, 0);
  const successes = asNumber(row.success_count, 0);
  if (!tests || tests < 0) return null;
  if (successes < 0) return 0;
  return Math.round((successes / tests) * 100);
}

/**
 * Normalize a Tier 1/2 free-proxy row (camelCase OR snake_case tolerant).
 * Tier rows use `id` as the persistence key (see `FreeProxyRow.id`).
 */
function normalizeFreeProxyRow(
  row: Record<string, unknown>,
  tier: 1 | 2 | 3,
  providerFallback: string,
  minQuality: number,
): ProxyPoolRow {
  const tierKey = tierToProxyTier(tier);
  const id = String(row.id ?? row.registryId ?? '');
  const host = String(row.host ?? '');
  const port = asNumber(row.port, 0);
  const inPool = Number(row.in_pool ?? 0) === 1;
  const qualityScore = asNullableNumber(row.quality_score ?? row.qualityScore);
  const testCount = asNumber(row.test_count ?? row.testCount, 0);
  const consecutiveFailures = asNumber(row.consecutive_failures ?? row.consecutiveFailures, 0);
  // Tier 2 candidates can be promoted, never "quarantined" by the package; we
  // reserve quarantined for future manual action results.
  const status = deriveStatus(tierKey, inPool, qualityScore, minQuality);
  const sourceId = id || `${host}:${port}`;
  return {
    selectionKey: buildSelectionKey(tierKey, sourceId),
    sourceId,
    tier: tierKey,
    provider: String(row.source ?? row.provider ?? providerFallback),
    type: String(row.type ?? 'http'),
    host,
    port,
    countryCode: asNullableString(row.country_code ?? row.countryCode ?? row.country),
    qualityScore,
    latencyMs: asNullableNumber(row.latency_ms ?? row.latencyMs),
    successRate: successRateFor({
      test_count: row.test_count ?? row.testCount,
      success_count: row.success_count ?? row.successCount,
    }),
    testCount,
    consecutiveFailures,
    status,
    lastCheckedAt: asNullableString(row.last_validated ?? row.lastValidated ?? row.updated_at ?? row.updatedAt),
  };
}

/**
 * Normalize a Tier 3 global-pool row. Global rows use `registryId` as the
 * persistence key (see `GlobalPoolRow.registryId`). Proxy registry rarely
 * surfaces quality/latency, so those are tolerated as null.
 */
function normalizeGlobalPoolRow(row: Record<string, unknown>): ProxyPoolRow {
  const registryId = String(row.registryId ?? row.id ?? '');
  const host = String(row.host ?? '');
  const port = asNumber(row.port, 0);
  const sourceId = registryId || `${host}:${port}`;
  return {
    selectionKey: buildSelectionKey('tier3', sourceId),
    sourceId,
    tier: 'tier3',
    provider: String(row.source ?? row.provider ?? 'db-proxy'),
    type: String(row.type ?? 'http'),
    host,
    port,
    countryCode: asNullableString(row.region ?? row.country_code ?? row.countryCode),
    qualityScore: asNullableNumber(row.quality_score ?? row.qualityScore),
    latencyMs: asNullableNumber(row.latency_ms ?? row.latencyMs),
    successRate: null,
    testCount: 0,
    consecutiveFailures: 0,
    status: 'active',
    lastCheckedAt: asNullableString(row.updated_at ?? row.updatedAt),
  };
}

function normalizeSettings(payload: unknown): ProxySettings {
  if (!isRecord(payload)) {
    return { ...DEFAULT_PROXY_SETTINGS, providers: { ...DEFAULT_PROXY_SETTINGS.providers } };
  }
  const s = payload as Record<string, unknown>;
  const providerPayload = isRecord(s.providers) ? s.providers : {};
  const providers: Record<string, boolean> = { ...DEFAULT_PROXY_SETTINGS.providers };
  for (const key of Object.keys(DEFAULT_PROXY_SETTINGS.providers)) {
    if (providerPayload[key] === undefined) continue;
    providers[key] = (providerPayload[key] as unknown) === true;
  }
  // Allow additional provider toggles returned by OmniRoute.
  for (const key of Object.keys(providerPayload)) {
    if (providers[key] === undefined) {
      providers[key] = (providerPayload[key] as unknown) === true;
    }
  }
  const checkIntervalMs = typeof s.checkIntervalMs === 'number' && Number.isFinite(s.checkIntervalMs)
    ? s.checkIntervalMs
    : typeof s.check_interval_ms === 'number' && Number.isFinite(s.check_interval_ms)
      ? s.check_interval_ms
      : undefined;
  const syncIntervalMs = typeof s.syncIntervalMs === 'number' && Number.isFinite(s.syncIntervalMs)
    ? s.syncIntervalMs
    : typeof s.sync_interval_ms === 'number' && Number.isFinite(s.sync_interval_ms)
      ? s.sync_interval_ms
      : undefined;
  const minutes = jobSettingsMsToMinutes(checkIntervalMs, syncIntervalMs);
  return {
    enabled: s.enabled === true,
    checkIntervalMinutes: asNumber(s.checkIntervalMinutes ?? minutes.checkIntervalMinutes, DEFAULT_PROXY_SETTINGS.checkIntervalMinutes),
    syncIntervalMinutes: asNumber(s.syncIntervalMinutes ?? minutes.syncIntervalMinutes, DEFAULT_PROXY_SETTINGS.syncIntervalMinutes),
    countryFilter: typeof s.countryFilter === 'string' && s.countryFilter.length > 0
      ? s.countryFilter.toUpperCase()
      : DEFAULT_PROXY_SETTINGS.countryFilter,
    minQuality: asNumber(s.minQuality ?? s.min_quality, DEFAULT_PROXY_SETTINGS.minQuality),
    minSuccessRate: asNumber(s.minSuccessRate ?? s.min_success_rate, DEFAULT_PROXY_SETTINGS.minSuccessRate),
    minTests: asNumber(s.minTests ?? s.min_tests, DEFAULT_PROXY_SETTINGS.minTests),
    poolSize: asNumber(s.poolSize ?? s.pool_size, DEFAULT_PROXY_SETTINGS.poolSize),
    autoElevate: s.autoElevate === true,
    autoRemoveDead: s.autoRemoveDead === true,
    tier1PromoteThreshold: asNumber(s.tier1PromoteThreshold ?? s.tier1_promote_threshold, DEFAULT_PROXY_SETTINGS.tier1PromoteThreshold),
    tier2PromoteThreshold: asNumber(s.tier2PromoteThreshold ?? s.tier2_promote_threshold, DEFAULT_PROXY_SETTINGS.tier2PromoteThreshold),
    tier2DemoteThreshold: asNumber(s.tier2DemoteThreshold ?? s.tier2_demote_threshold, DEFAULT_PROXY_SETTINGS.tier2DemoteThreshold),
    liveFailThreshold: asNumber(s.liveFailThreshold ?? s.live_fail_threshold, DEFAULT_PROXY_SETTINGS.liveFailThreshold),
    autoDistribute: s.autoDistribute === true,
    providers,
  };
}

function normalizeSnapshot(payload: unknown): ProxyControlSnapshot {
  const empty = emptyProxyControlSnapshot();
  if (!isRecord(payload)) return empty;

  const tiersPayload = isRecord(payload.tiers) ? payload.tiers : {};
  const settings = normalizeSettings(payload.settings);
  const minQuality = settings.minQuality;

  const tier1Raw = Array.isArray(tiersPayload.tier1) ? tiersPayload.tier1 : [];
  const tier2Raw = Array.isArray(tiersPayload.tier2) ? tiersPayload.tier2 : [];
  const tier3Raw = Array.isArray(tiersPayload.tier3) ? tiersPayload.tier3 : [];

  const tier1 = tier1Raw
    .filter(isRecord)
    .map((row) => normalizeFreeProxyRow(row, 1, 'proxyscraper', minQuality));
  const tier2 = tier2Raw
    .filter(isRecord)
    .map((row) => normalizeFreeProxyRow(row, 2, 'oneproxy', minQuality));
  const tier3 = tier3Raw
    .filter(isRecord)
    .map((row) => normalizeGlobalPoolRow(row));

  return {
    tiers: { tier1, tier2, tier3 },
    settings,
    source: payload.source === 'omniroute' ? 'omniroute' : 'unavailable',
    counts: { tier1: tier1.length, tier2: tier2.length, tier3: tier3.length },
    globalPoolCount: asNumber(payload.globalPoolCount ?? payload.global_pool_count, tier3.length),
    lastSyncedAt: asNullableString(payload.lastSyncedAt ?? payload.last_synced_at),
  };
}

async function readBody<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * GET the full proxy-control snapshot from OmniRoute. Returns the normalized
 * snapshot; on any transport failure or non-2xx response it degrades to an
 * `unavailable` snapshot so the UI never renders mock rows.
 */
export async function fetchProxyControlSnapshot(): Promise<ProxyControlSnapshot> {
  try {
    const res = await omnirouteFetch(PROXY_CONTROL_PATH, { cache: 'no-store' });
    if (!res.ok) {
      return emptyProxyControlSnapshot();
    }
    const body = await readBody<unknown>(res);
    const snapshot = normalizeSnapshot(body);
    // Mark as unavailable if OmniRoute returned nothing parseable.
    if (snapshot.tiers.tier1.length === 0 && snapshot.tiers.tier2.length === 0 && snapshot.tiers.tier3.length === 0) {
      // Keep explicit source flag from OmniRoute if present; otherwise unavailable.
      if (snapshot.source !== 'omniroute') {
        snapshot.source = 'unavailable';
      }
    }
    return snapshot;
  } catch (error) {
    console.warn('Proxy control snapshot fetch failed:', error);
    return emptyProxyControlSnapshot();
  }
}

export type ProxySettingsPatch = Partial<ProxySettings> & { providers?: Record<string, boolean>; actor?: string };

/**
 * PATCH proxy settings forward to OmniRoute. Returns the fresh snapshot on
 * success. When OmniRoute returns a non-2xx (e.g. endpoint missing), we return
 * an error descriptor instead so the API route can surface a 502 with context.
 */
export async function patchProxyControlSettings(
  patch: ProxySettingsPatch,
): Promise<{ ok: true; snapshot: ProxyControlSnapshot } | { ok: false; error: ProxyControlBridgeError }> {
  try {
    const res = await omnirouteFetch(SETTINGS_PATH, {
      method: 'PATCH',
      cache: 'no-store',
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = await readBody<{ error?: string }>(res);
      return {
        ok: false,
        error: {
          status: res.status,
          message: body?.error || `OmniRoute returned ${res.status}`,
        },
      };
    }
    const body = await readBody<unknown>(res);
    return { ok: true, snapshot: normalizeSnapshot(body) };
  } catch (error) {
    console.error('Proxy control settings patch failed:', error);
    return {
      ok: false,
      error: { status: 502, message: error instanceof Error ? error.message : 'OmniRoute unreachable' },
    };
  }
}

/**
 * POST a manual action forward to OmniRoute. On a non-2xx response, returns
 * the error descriptor (including the applied/skipped counts reported by the
 * OmniRoute side when available).
 */
export async function postProxyControlAction(action: {
  action: string;
  selectionKeys: string[];
  actor?: string;
}): Promise<
  | { ok: true; result: { success: boolean; action: string; applied: number; skipped: number; errors: Array<{ selectionKey: string; error: string }> } }
  | { ok: false; error: ProxyControlBridgeError; partial?: { applied: number; skipped: number } }
> {
  try {
    const res = await omnirouteFetch(ACTIONS_PATH, {
      method: 'POST',
      cache: 'no-store',
      body: JSON.stringify(action),
    });
    const body = await readBody<{
      success?: boolean;
      action?: string;
      applied?: number;
      skipped?: number;
      errors?: Array<{ selectionKey: string; error: string }>;
      error?: string;
    }>(res);
    if (!res.ok) {
      return {
        ok: false,
        error: {
          status: res.status,
          message: body?.error || `OmniRoute returned ${res.status}`,
        },
        partial: body && typeof body.applied === 'number' ? { applied: body.applied, skipped: body.skipped ?? 0 } : undefined,
      };
    }
    return {
      ok: true,
      result: {
        success: body?.success !== false,
        action: String(body?.action ?? action.action),
        applied: asNumber(body?.applied, 0),
        skipped: asNumber(body?.skipped, 0),
        errors: Array.isArray(body?.errors) ? body.errors : [],
      },
    };
  } catch (error) {
    console.error('Proxy control action failed:', error);
    return {
      ok: false,
      error: { status: 502, message: error instanceof Error ? error.message : 'OmniRoute unreachable' },
    };
  }
}
