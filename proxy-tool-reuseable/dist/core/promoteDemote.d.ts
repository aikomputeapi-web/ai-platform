import type { DbAdapter, Logger } from "../adapters.js";
import type { PromotionCandidate } from "../types.js";
export declare function promoteProxyToGlobal(db: DbAdapter, log: Logger, candidate: PromotionCandidate, country: string, poolSize: number, namePrefix: string): Promise<void>;
/**
 * Demote a Tier 3 (global pool) proxy back down to `targetTier` (2 or 1) and
 * optionally pre-seed `consecutive_failures` so that the next failure in the
 * target tier trips that tier's demotion rule immediately. This powers the
 * "Tier 3 fails once → Tier 2; if it immediately fails again → Tier 1" rule:
 * a fresh tier-3 demote targets Tier 2 with failureHeadStart set so the next
 * single Tier 2 check failure crosses the Tier 2 demote threshold and drops
 * it to Tier 1.
 */
export declare function demoteTier3Proxy(db: DbAdapter, log: Logger, registryId: string, host: string, targetTier: 2 | 1, failureHeadStart?: number): Promise<void>;
//# sourceMappingURL=promoteDemote.d.ts.map