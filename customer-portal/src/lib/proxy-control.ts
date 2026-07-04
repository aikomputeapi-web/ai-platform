/**
 * Proxy Control Center — shared DTO contract.
 *
 * This DTO is aligned to `JobSettings` from the reusable proxy package
 * (`proxy-tool-reuseable/src/types.ts`) so the customer portal and the
 * owning proxy service speak the same field names. It intentionally does
 * NOT import the proxy package: the package requires `better-sqlite3` /
 * `undici` peer-dependencies and is not a dependency of the customer portal,
 * so importing it would pull in adapters the portal never loads. The
 * customer portal proxies all persistence to the OmniRoute service that owns
 * the proxy pool SQLite database (see `src/app/api/admin/proxy-control/*`).
 *
 * Field reference:
 * - `enabled`              → JobSettings.enabled
 * - `checkIntervalMinutes`  → JobSettings.checkIntervalMs   (ms/60000)
 * - `syncIntervalMinutes`   → JobSettings.syncIntervalMs     (ms/60000)
 * - `countryFilter`         → JobSettings.countryFilter
 * - `minQuality`            → JobSettings.minQuality
 * - `minSuccessRate`        → JobSettings.minSuccessRate
 * - `minTests`              → JobSettings.minTests
 * - `poolSize`              → JobSettings.poolSize
 * - `autoElevate`           → JobSettings.autoElevate
 * - `autoRemoveDead`        → JobSettings.autoRemoveDead
 * - `tier1PromoteThreshold` → JobSettings.tier1PromoteThreshold
 * - `tier2DemoteThreshold`  → JobSettings.tier2DemoteThreshold
 * - `liveFailThreshold`     → JobSettings.liveFailThreshold
 * - `autoDistribute`        → JobSettings.autoDistribute
 *
 * Provider toggles are not part of `JobSettings` in the package; they are a
 * portal-side convenience map keyed by FreeProxySourceId union members.
 */

export type ProxyTier = 'tier1' | 'tier2' | 'tier3';

export type ProxyPoolRowStatus = 'intake' | 'candidate' | 'active' | 'quarantined';

export type ProxyControlSource = 'omniroute' | 'unavailable';

/**
 * Normalized row shape used by the Proxy Control Center UI across all tiers.
 * Tier 1/2 free pool rows carry `sourceId` from `FreeProxyRow.id`;
 * Tier 3 global pool rows carry `sourceId` from `GlobalPoolRow.registryId`.
 * `selectionKey` is `${tier}:${sourceId}` and is the only selection contract.
 */
export interface ProxyPoolRow {
  selectionKey: string;
  sourceId: string;
  tier: ProxyTier;
  provider: string;
  type: string;
  host: string;
  port: number;
  countryCode: string | null;
  qualityScore: number | null;
  latencyMs: number | null;
  successRate: number | null;
  testCount: number;
  consecutiveFailures: number;
  status: ProxyPoolRowStatus;
  lastCheckedAt: string | null;
}

export interface ProxySettings {
  enabled: boolean;
  checkIntervalMinutes: number;
  syncIntervalMinutes: number;
  countryFilter: string;
  minQuality: number;
  minSuccessRate: number;
  minTests: number;
  poolSize: number;
  autoElevate: boolean;
  autoRemoveDead: boolean;
  tier1PromoteThreshold: number;
  tier2DemoteThreshold: number;
  liveFailThreshold: number;
  autoDistribute: boolean;
  providers: Record<string, boolean>;
}

export interface ProxyControlSnapshot {
  tiers: Record<ProxyTier, ProxyPoolRow[]>;
  settings: ProxySettings;
  source: ProxyControlSource;
  counts: Record<ProxyTier, number>;
  globalPoolCount: number;
  lastSyncedAt: string | null;
}

export type ProxyManualAction =
  | 'promote'
  | 'demote'
  | 'quarantine'
  | 'remove'
  | 'run-check'
  | 'run-sync';

export interface ProxyActionRequest {
  action: ProxyManualAction;
  /** selection keys, each `${tier}:${sourceId}` */
  selectionKeys: string[];
  actor?: string;
}

export interface ProxyActionResult {
  success: boolean;
  action: ProxyManualAction;
  applied: number;
  skipped: number;
  errors: Array<{ selectionKey: string; error: string }>;
}

export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  enabled: false,
  checkIntervalMinutes: 10,
  syncIntervalMinutes: 30,
  countryFilter: 'US',
  minQuality: 40,
  minSuccessRate: 100,
  minTests: 5,
  poolSize: 20,
  autoElevate: true,
  autoRemoveDead: true,
  tier1PromoteThreshold: 5,
  tier2DemoteThreshold: 2,
  liveFailThreshold: 3,
  autoDistribute: false,
  providers: {
    proxyscraper: true,
    proxypool: true,
    proxifly: false,
    oneproxy: true,
    iplocate: false,
  },
};

export const PROXY_PROVIDER_KEYS = Object.keys(DEFAULT_PROXY_SETTINGS.providers);

/**
 * Build the normalized `selectionKey` for any tier row. Kept here so both the
 * API layer and the UI agree on the contract without re-deriving it.
 */
export function buildSelectionKey(tier: ProxyTier, sourceId: string): string {
  return `${tier}:${sourceId}`;
}

export function settingsToJobSettingsMs(settings: ProxySettings): {
  checkIntervalMs: number;
  syncIntervalMs: number;
} {
  return {
    checkIntervalMs: Math.max(1, Math.round(settings.checkIntervalMinutes * 60_000)),
    syncIntervalMs: Math.max(1, Math.round(settings.syncIntervalMinutes * 60_000)),
  };
}

export function jobSettingsMsToMinutes(checkIntervalMs?: number, syncIntervalMs?: number): {
  checkIntervalMinutes: number;
  syncIntervalMinutes: number;
} {
  return {
    checkIntervalMinutes:
      typeof checkIntervalMs === 'number' && checkIntervalMs > 0
        ? Math.max(1, Math.round(checkIntervalMs / 60_000))
        : DEFAULT_PROXY_SETTINGS.checkIntervalMinutes,
    syncIntervalMinutes:
      typeof syncIntervalMs === 'number' && syncIntervalMs > 0
        ? Math.max(1, Math.round(syncIntervalMs / 60_000))
        : DEFAULT_PROXY_SETTINGS.syncIntervalMinutes,
  };
}

export function emptyProxyControlSnapshot(): ProxyControlSnapshot {
  return {
    tiers: { tier1: [], tier2: [], tier3: [] },
    settings: { ...DEFAULT_PROXY_SETTINGS, providers: { ...DEFAULT_PROXY_SETTINGS.providers } },
    source: 'unavailable',
    counts: { tier1: 0, tier2: 0, tier3: 0 },
    globalPoolCount: 0,
    lastSyncedAt: null,
  };
}
