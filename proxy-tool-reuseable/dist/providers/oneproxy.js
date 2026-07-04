function isPrivateHost(host) {
    if (!host)
        return true;
    const parts = host.split(".");
    if (parts.length !== 4)
        return false;
    const nums = parts.map(Number);
    if (nums.some((n) => isNaN(n) || n < 0 || n > 255))
        return false;
    if (nums[0] === 10)
        return true;
    if (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31)
        return true;
    if (nums[0] === 192 && nums[1] === 168)
        return true;
    if (nums[0] === 127)
        return true;
    if (nums[0] === 0)
        return true;
    if (nums[0] === 169 && nums[1] === 254)
        return true;
    return false;
}
const DEFAULT_API_URL = "https://1proxy-api.aitradepulse.com/api/v1/proxies/advanced";
const DEFAULT_MAX = 500;
const DEFAULT_MIN_QUALITY = 50;
const DEFAULT_PAGE_SIZE = 100;
const MAX_CONSECUTIVE_FAILURES = 5;
export class OneproxyProvider {
    id = "1proxy";
    name = "1proxy";
    consecutiveFailures = 0;
    isEnabled() {
        return process.env.FREE_PROXY_1PROXY_ENABLED !== "false";
    }
    getConfig() {
        return {
            apiUrl: process.env.FREE_PROXY_1PROXY_API_URL || DEFAULT_API_URL,
            maxProxies: parseInt(process.env.FREE_PROXY_1PROXY_MAX || "", 10) || DEFAULT_MAX,
            minQuality: parseInt(process.env.FREE_PROXY_1PROXY_MIN_QUALITY || "", 10) || DEFAULT_MIN_QUALITY,
        };
    }
    async sync() {
        if (!this.isEnabled()) {
            return { fetched: 0, added: 0, updated: 0, errors: ["1proxy provider disabled"] };
        }
        if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            return {
                fetched: 0,
                added: 0,
                updated: 0,
                errors: [`Circuit breaker open: ${this.consecutiveFailures} consecutive failures`],
            };
        }
        const { upsertFreeProxy } = await import("./db-proxy.js");
        const { apiUrl, maxProxies, minQuality } = this.getConfig();
        const errors = [];
        let added = 0;
        let updated = 0;
        let fetched = 0;
        let offset = 0;
        try {
            while (fetched < maxProxies) {
                const limit = Math.min(DEFAULT_PAGE_SIZE, maxProxies - fetched);
                const url = `${apiUrl}?offset=${offset}&limit=${limit}&min_quality_score=${minQuality}`;
                const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    errors.push(`HTTP ${res.status}: ${text.slice(0, 100)}`);
                    this.consecutiveFailures++;
                    break;
                }
                const json = (await res.json());
                if (!Array.isArray(json.proxies) || json.proxies.length === 0)
                    break;
                for (const p of json.proxies) {
                    if (!p.ip || isPrivateHost(p.ip)) {
                        errors.push(`1proxy: skipped private/loopback host ${p.ip}`);
                        continue;
                    }
                    const item = {
                        source: "1proxy",
                        host: p.ip,
                        port: p.port,
                        type: p.protocol?.toLowerCase() || "http",
                        countryCode: p.country_code || null,
                        qualityScore: p.quality_score ?? null,
                        latencyMs: p.latency_ms ?? null,
                        anonymity: p.anonymity || null,
                        lastValidated: p.last_validated || new Date().toISOString(),
                    };
                    const result = await upsertFreeProxy(item);
                    if (result.action === "created")
                        added++;
                    else if (result.action === "updated")
                        updated++;
                }
                fetched += json.proxies.length;
                offset += json.proxies.length;
                if (json.proxies.length < limit)
                    break;
            }
            this.consecutiveFailures = 0;
        }
        catch (err) {
            this.consecutiveFailures++;
            errors.push(err instanceof Error ? err.message : String(err));
        }
        return { fetched, added, updated, errors };
    }
    async list(filters) {
        const { listFreeProxiesBySource } = await import("./db-proxy.js");
        return listFreeProxiesBySource("1proxy", filters);
    }
}
//# sourceMappingURL=oneproxy.js.map