import type { FreeProxyItem, FreeProxySyncResult, FreeProxyProvider } from "./types.js";
export declare class ProxyScraperProvider implements FreeProxyProvider {
    readonly id: "proxyscraper";
    readonly name = "ProxyScraper";
    isEnabled(): boolean;
    private getConfig;
    private latencyToQuality;
    private normalizeProtocol;
    private syncFromJson;
    private syncFromTxtFiles;
    sync(): Promise<FreeProxySyncResult>;
    list(filters: {
        protocol?: string;
        country?: string;
        minQuality?: number;
        limit?: number;
    }): Promise<FreeProxyItem[]>;
}
//# sourceMappingURL=proxyscraper.d.ts.map