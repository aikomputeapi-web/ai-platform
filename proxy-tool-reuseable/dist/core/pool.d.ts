import type { DbAdapter, Logger, SettingsStore, AlertSink, FailureFeed, ProxyProbe, CandidateSource } from "../adapters.js";
import type { FreeProxyProvider } from "../providers/types.js";
export interface FreeProxyPoolOptions {
    db: DbAdapter;
    log: Logger;
    settings: SettingsStore;
    alerts: AlertSink;
    failures: FailureFeed;
    probe: ProxyProbe;
    providers: FreeProxyProvider[];
    candidateSource?: CandidateSource;
    distribute?: () => Promise<void>;
}
export interface FreeProxyPool {
    start(): void;
    stop(): void;
    reload(): Promise<void>;
    runCheckTick(): Promise<void>;
    runSyncTick(): Promise<void>;
    findWorkingProxy(targetHostname: string, targetUrl: string): Promise<string | null>;
}
export declare function createFreeProxyPool(options: FreeProxyPoolOptions): FreeProxyPool;
//# sourceMappingURL=pool.d.ts.map