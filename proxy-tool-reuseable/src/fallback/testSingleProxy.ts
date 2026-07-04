import type { ProxyProbe } from "../adapters.js";

export function createTestSingleProxy(
  probe: ProxyProbe
): (proxyUrl: string, targetUrl: string, timeoutMs?: number) => Promise<{ ok: boolean; latencyMs: number | null }> {
  return async (
    proxyUrl: string,
    targetUrl: string,
    timeoutMs = 3000
  ): Promise<{ ok: boolean; latencyMs: number | null }> => {
    return probe.test(proxyUrl, targetUrl, timeoutMs);
  };
}
