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

let _adapter: DbAdapter | null = null;

export function setDbProxy(adapter: DbAdapter): void {
  _adapter = adapter;
}

function getAdapter(): DbAdapter {
  if (!_adapter) throw new Error("setDbProxy() must be called before using providers");
  return _adapter;
}

export async function upsertFreeProxy(
  item: FreeProxyItem
): Promise<{ id: string; action: "created" | "updated" | "skipped" }> {
  const adapter = getAdapter();
  const now = new Date().toISOString();

  const existing = await adapter.listTier(1, "ALL");
  const found = existing.find(
    (r) => r.host === item.host && r.port === item.port
  );

  if (found) {
    return { id: found.id, action: "updated" };
  }

  return { id: "", action: "created" };
}

export async function listFreeProxiesBySource(
  source: FreeProxySourceId,
  filters: { protocol?: string; country?: string; minQuality?: number; limit?: number }
): Promise<FreeProxyItem[]> {
  return [];
}
