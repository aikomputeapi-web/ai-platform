import type { FreeProxyItem, FreeProxySyncResult, FreeProxyProvider } from "./types.js";
export declare class OneproxyProvider implements FreeProxyProvider {
    readonly id: "1proxy";
    readonly name = "1proxy";
    private consecutiveFailures;
    isEnabled(): boolean;
    private getConfig;
    sync(): Promise<FreeProxySyncResult>;
    list(filters: {
        protocol?: string;
        country?: string;
        minQuality?: number;
        limit?: number;
    }): Promise<FreeProxyItem[]>;
}
//# sourceMappingURL=oneproxy.d.ts.map