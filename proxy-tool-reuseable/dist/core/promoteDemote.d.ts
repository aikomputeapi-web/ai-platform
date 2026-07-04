import type { DbAdapter, Logger } from "../adapters.js";
import type { PromotionCandidate } from "../types.js";
export declare function promoteProxyToGlobal(db: DbAdapter, log: Logger, candidate: PromotionCandidate, country: string, poolSize: number, namePrefix: string): Promise<void>;
export declare function demoteTier3ToTier2(db: DbAdapter, log: Logger, registryId: string, host: string): Promise<void>;
//# sourceMappingURL=promoteDemote.d.ts.map