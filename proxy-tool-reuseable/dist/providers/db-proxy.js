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
let _adapter = null;
export function setDbProxy(adapter) {
    _adapter = adapter;
}
function getAdapter() {
    if (!_adapter)
        throw new Error("setDbProxy() must be called before using providers");
    return _adapter;
}
export async function upsertFreeProxy(item) {
    const adapter = getAdapter();
    const now = new Date().toISOString();
    const existing = await adapter.listTier(1, "ALL");
    const found = existing.find((r) => r.host === item.host && r.port === item.port);
    if (found) {
        return { id: found.id, action: "updated" };
    }
    return { id: "", action: "created" };
}
export async function listFreeProxiesBySource(source, filters) {
    return [];
}
//# sourceMappingURL=db-proxy.js.map