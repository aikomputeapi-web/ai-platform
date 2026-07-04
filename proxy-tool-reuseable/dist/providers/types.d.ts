export type FreeProxySourceId = "1proxy" | "proxifly" | "iplocate" | "proxypool" | "proxyscraper";
export interface FreeProxyItem {
    source: FreeProxySourceId;
    host: string;
    port: number;
    type: "http" | "https" | "socks4" | "socks5";
    countryCode: string | null;
    qualityScore: number | null;
    latencyMs: number | null;
    anonymity: string | null;
    lastValidated: string | null;
}
export interface FreeProxySyncResult {
    fetched: number;
    added: number;
    updated: number;
    errors: string[];
}
export interface FreeProxyProvider {
    readonly id: FreeProxySourceId;
    readonly name: string;
    isEnabled(): boolean;
    sync(): Promise<FreeProxySyncResult>;
    list(filters: {
        protocol?: string;
        country?: string;
        minQuality?: number;
        limit?: number;
    }): Promise<FreeProxyItem[]>;
}
//# sourceMappingURL=types.d.ts.map