import type { FreeProxyItem, FreeProxySyncResult, FreeProxyProvider } from "./types.js";
export declare class ProxiflyProvider implements FreeProxyProvider {
    readonly id: "proxifly";
    readonly name = "Proxifly";
    isEnabled(): boolean;
    sync(): Promise<FreeProxySyncResult>;
    list(filters: {
        protocol?: string;
        country?: string;
        minQuality?: number;
        limit?: number;
    }): Promise<FreeProxyItem[]>;
}
//# sourceMappingURL=proxifly.d.ts.map