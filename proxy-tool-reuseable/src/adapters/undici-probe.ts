import type { ProxyProbe } from "../adapters.js";

type AnyProxyAgent = new (url: string) => unknown;

export function createUndiciProbe(defaultTimeoutMs = 3000): ProxyProbe {
  return {
    async test(
      proxyUrl: string,
      targetUrl: string,
      timeoutMs: number
    ): Promise<{ ok: boolean; latencyMs: number | null }> {
      const start = Date.now();
      try {
        let undiciFetch: typeof fetch;
        let ProxyAgent: AnyProxyAgent | null = null;

        try {
          const undici = await import("undici") as typeof import("undici");
          undiciFetch = (undici as any).fetch ?? globalThis.fetch;
          ProxyAgent = (undici as any).ProxyAgent ?? null;
        } catch {
          undiciFetch = globalThis.fetch;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const opts: Record<string, unknown> = {
          method: "HEAD",
          signal: controller.signal,
          headers: { "User-Agent": "FreeProxyPool/1.0" },
        };

        if (ProxyAgent) {
          opts.dispatcher = new (ProxyAgent as any)(proxyUrl);
        }

        await (undiciFetch as any)(targetUrl, opts);
        clearTimeout(timeout);

        return { ok: true, latencyMs: Date.now() - start };
      } catch {
        return { ok: false, latencyMs: null };
      }
    },
  };
}
