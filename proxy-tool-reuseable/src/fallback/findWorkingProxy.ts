import type { CandidateSource, ProxyProbe, Logger } from "../adapters.js";

interface CacheEntry {
  proxyUrl: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 45 * 1000;

const cache = new Map<string, CacheEntry>();

export function clearProxyFallbackCache(): void {
  cache.clear();
}

export async function findWorkingProxy(
  candidateSource: CandidateSource,
  probe: ProxyProbe,
  log: Logger,
  targetHostname: string,
  targetUrl: string
): Promise<string | null> {
  if (!targetHostname) return null;

  const cached = cache.get(targetHostname);
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      return cached.proxyUrl || null;
    }
    cache.delete(targetHostname);
  }

  const candidates = await candidateSource.list(targetUrl);
  if (candidates.length === 0) {
    return null;
  }

  const results = await Promise.allSettled(
    candidates.map(async (proxyUrl) => {
      const { ok } = await probe.test(proxyUrl, targetUrl, 3000);
      return { proxyUrl, ok };
    })
  );

  const working = results.find((r) => r.status === "fulfilled" && r.value.ok);

  if (working && working.status === "fulfilled") {
    const proxyUrl = working.value.proxyUrl;
    cache.set(targetHostname, {
      proxyUrl,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return proxyUrl;
  }

  cache.set(targetHostname, {
    proxyUrl: "",
    expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS,
  });

  return null;
}
