import type { DbAdapter, Logger, AlertSink, FailureFeed, ProxyProbe } from "../adapters.js";
import type { JobSettings } from "../types.js";
import type { FreeProxyProvider } from "../providers/types.js";
export interface TickDeps {
    db: DbAdapter;
    log: Logger;
    alerts: AlertSink;
    failures: FailureFeed;
    probe: ProxyProbe;
    providers: FreeProxyProvider[];
    distribute?: () => Promise<void>;
}
export declare function runFreeProxyCheckTick(deps: TickDeps, settings?: JobSettings): Promise<void>;
export declare function runFreeProxySyncTick(deps: TickDeps, settings?: JobSettings): Promise<void>;
//# sourceMappingURL=ticks.d.ts.map