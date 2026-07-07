import type { FreeProxyRow, GlobalPoolRow, PromotionCandidate, JobSettings, ProxyPoolAlert } from "./types.js";

/**
 * db — CRUD over free_proxies + proxy_registry + proxy_assignments
 *
 * Replaces the inline SQL currently in OmniRoute/src/lib/jobs/freeProxyJob.ts
 * and OmniRoute/src/lib/db/freeProxies.ts.
 */
export interface DbAdapter {
  listTier(tier: 1 | 2 | 3, countryFilter: string | "ALL"): Promise<FreeProxyRow[]>;
  listGlobalPool(): Promise<GlobalPoolRow[]>;
  countGlobalPool(): Promise<number>;
  listPromotionCandidates(
    countryFilter: string | "ALL",
    minTests: number,
    minQuality: number,
    limit: number
  ): Promise<PromotionCandidate[]>;
  recordTestResult(
    id: string,
    ok: boolean,
    latencyMs: number | null,
    quality: number
  ): Promise<void>;
  setTier(id: string, tier: 1 | 2 | 3): Promise<void>;
  resetCounters(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  demoteFromGlobalPool(registryId: string, host: string): Promise<void>;
  /**
   * Demote a Tier 3 (global pool) proxy back into the free_proxies table at
   * the given target tier (2 = verified, 1 = intake) instead of hard-deleting
   * it. Counters are reset, with an optional `failureHeadStart` setting
   * `consecutive_failures` so the proxy drops further on its next failure
   * (used by the "Tier 3 fails once → Tier 2; fails again → Tier 1" rule).
   */
  demoteFromGlobalPoolToTier(
    registryId: string,
    host: string,
    targetTier: 1 | 2,
    failureHeadStart?: number
  ): Promise<void>;
  promoteToGlobalCandidate(
    candidate: PromotionCandidate,
    country: string,
    poolSize: number,
    namePrefix: string
  ): Promise<void>;
  deleteNonMatchingCountry(country: string): Promise<number>;
}

/**
 * Logger — structured logging
 *
 * Replaces createLogger("free-proxy-job") from @/shared/utils/logger.
 */
export interface Logger {
  info(objOrMsg: Record<string, unknown> | string, msg?: string): void;
  warn(objOrMsg: Record<string, unknown> | string, msg?: string): void;
  error(objOrMsg: Record<string, unknown> | string, msg?: string): void;
  debug(objOrMsg: Record<string, unknown> | string, msg?: string): void;
}

/**
 * SettingsStore — reads JobSettings from config source
 *
 * Replaces getSettings() reading freeProxy* keys from OmniRoute/src/lib/db/settings.ts.
 */
export interface SettingsStore {
  get(): Promise<JobSettings>;
  shouldReload(): boolean;
}

/**
 * AlertSink — dispatch proxy pool alerts
 *
 * Replaces dispatchEvent for proxy.demoted / proxy.pool-low via OmniRoute/src/lib/webhookDispatcher.ts.
 */
export interface AlertSink {
  emit(alert: ProxyPoolAlert): Promise<void>;
}

/**
 * FailureFeed — tracks recent real-request proxy failures
 *
 * Replaces getRecentProxyFailures from OmniRoute/src/lib/proxyLogger.ts.
 */
export interface FailureFeed {
  recentFailures(windowMs: number): Map<string, number>;
  record?(hostPort: string, status: string): void;
}

/**
 * ProxyProbe — tests reachability through a proxy URL against a target
 *
 * Replaces testSingleProxy from @omniroute/open-sse/utils/proxyFallback.
 */
export interface ProxyProbe {
  test(proxyUrl: string, targetUrl: string, timeoutMs: number): Promise<{
    ok: boolean;
    latencyMs: number | null;
  }>;
}

/**
 * CandidateSource — provides proxy candidates for fallback resolution
 *
 * Replaces getProxyCandidates from OmniRoute/open-sse/utils/proxyFallback.ts.
 */
export interface CandidateSource {
  list(targetUrl?: string): Promise<string[]>;
}
