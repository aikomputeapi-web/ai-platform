import type { FreeProxyItem, FreeProxySyncResult, FreeProxyProvider } from "./types.js";
export declare class IplocateProvider implements FreeProxyProvider {
    readonly id: "iplocate";
    readonly name = "IPLocate";
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
//# sourceMappingURL=iplocate.d.ts.map