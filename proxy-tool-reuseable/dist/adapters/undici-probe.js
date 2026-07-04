export function createUndiciProbe(defaultTimeoutMs = 3000) {
    return {
        async test(proxyUrl, targetUrl, timeoutMs) {
            const start = Date.now();
            try {
                let undiciFetch;
                let ProxyAgent = null;
                try {
                    const undici = await import("undici");
                    undiciFetch = undici.fetch ?? globalThis.fetch;
                    ProxyAgent = undici.ProxyAgent ?? null;
                }
                catch {
                    undiciFetch = globalThis.fetch;
                }
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), timeoutMs);
                const opts = {
                    method: "HEAD",
                    signal: controller.signal,
                    headers: { "User-Agent": "FreeProxyPool/1.0" },
                };
                if (ProxyAgent) {
                    opts.dispatcher = new ProxyAgent(proxyUrl);
                }
                await undiciFetch(targetUrl, opts);
                clearTimeout(timeout);
                return { ok: true, latencyMs: Date.now() - start };
            }
            catch {
                return { ok: false, latencyMs: null };
            }
        },
    };
}
//# sourceMappingURL=undici-probe.js.map