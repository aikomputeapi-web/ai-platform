import type { FreeProxyItem, FreeProxySyncResult, FreeProxyProvider } from "./types.js";
export declare class ProxyPoolProvider implements FreeProxyProvider {
    readonly id: "proxypool";
    readonly name = "ProxyPool";
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
//# sourceMappingURL=proxypool.d.ts.map