const DEFAULT_LIVE_FAIL_THRESHOLD = 3;
/**
 * Default job settings for the 3-tier free proxy pool.
 *
 * Tier flow:
 *   Tier 1 (intake)  ──5 consecutive successes──►  Tier 2 (verified/waiting)
 *   Tier 2            ──10 consecutive successes──►  Tier 3 (active/in-use)
 *
 * Demotion:
 *   Tier 1 ──5 consecutive failures──► deleted
 *   Tier 2 ──3 consecutive failures──► Tier 1 (counters reset, retest from scratch)
 *   Tier 3 ──1 failure──► Tier 2; if it then fails its next test in Tier 2
 *           (failure count already pre-seeded) it drops to Tier 1.
 *
 * The check tick runs every `checkIntervalMs` (default 5 minutes) and tests
 * every proxy in all three tiers.
 */
export const DEFAULT_JOB_SETTINGS = {
    enabled: process.env.FREE_PROXY_AUTO_JOB_ENABLED !== "false",
    checkIntervalMs: 5 * 60 * 1000,
    syncIntervalMs: 30 * 60 * 1000,
    countryFilter: (process.env.FREE_PROXY_COUNTRY_FILTER || "US").toUpperCase(),
    minQuality: 40,
    minTests: 5,
    minSuccessRate: 100,
    autoElevate: true,
    poolSize: 20,
    autoRemoveDead: true,
    tier1PromoteThreshold: 5,
    tier2PromoteThreshold: 10,
    tier2DemoteThreshold: 3,
    liveFailThreshold: DEFAULT_LIVE_FAIL_THRESHOLD,
    autoDistribute: process.env.FREE_PROXY_AUTO_DISTRIBUTE === "true",
};
export function getSettingsHash(s) {
    return `${s.enabled}:${s.checkIntervalMs}:${s.syncIntervalMs}:${s.countryFilter}:${s.minQuality}:${s.minTests}:${s.minSuccessRate}:${s.autoElevate}:${s.tier1PromoteThreshold}:${s.tier2PromoteThreshold}:${s.tier2DemoteThreshold}`;
}
//# sourceMappingURL=settings.js.map