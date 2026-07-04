import type { ProxyProbe } from "../adapters.js";
export declare function testProxyMultiTarget(probe: ProxyProbe, proxyUrl: string, perTargetTimeoutMs: number, targets?: string[]): Promise<{
    ok: boolean;
    latencyMs: number | null;
}>;
//# sourceMappingURL=probe.d.ts.map