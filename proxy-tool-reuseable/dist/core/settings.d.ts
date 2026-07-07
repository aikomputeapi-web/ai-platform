import type { JobSettings } from "../types.js";
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
export declare const DEFAULT_JOB_SETTINGS: JobSettings;
export declare function getSettingsHash(s: JobSettings): string;
//# sourceMappingURL=settings.d.ts.map