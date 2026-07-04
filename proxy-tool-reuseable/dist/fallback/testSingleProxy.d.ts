import type { ProxyProbe } from "../adapters.js";
export declare function createTestSingleProxy(probe: ProxyProbe): (proxyUrl: string, targetUrl: string, timeoutMs?: number) => Promise<{
    ok: boolean;
    latencyMs: number | null;
}>;
//# sourceMappingURL=testSingleProxy.d.ts.map