/**
 * Dynamic-import bridge used by provider sync() methods.
 *
 * The providers (iplocate, oneproxy, proxifly, proxypool, proxyscraper) each
 * `await import("./db-proxy")` at runtime.  This module re-exports the canonical
 * free-proxies DB functions so the provider sources don't need to know about the
 * adapter interface — they just call upsertFreeProxy / listFreeProxiesBySource.
 *
 * The consumer must call setDbProxy(adapter) before running any sync().
 */
import type { DbAdapter } from "../adapters.js";
import type { FreeProxyItem, FreeProxySourceId } from "./types.js";
export declare function setDbProxy(adapter: DbAdapter): void;
export declare function upsertFreeProxy(item: FreeProxyItem): Promise<{
    id: string;
    action: "created" | "updated" | "skipped";
}>;
export declare function listFreeProxiesBySource(source: FreeProxySourceId, filters: {
    protocol?: string;
    country?: string;
    minQuality?: number;
    limit?: number;
}): Promise<FreeProxyItem[]>;
//# sourceMappingURL=db-proxy.d.ts.map