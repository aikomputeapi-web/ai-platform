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
const DEFAULT_QUANTITY = 200;
const DEFAULT_ANONYMITY = "elite";
const DEFAULT_API_URL = "https://api.proxifly.dev/proxy";
const DEFAULT_PROTOCOLS = ["http", "https", "socks5"];
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_BATCH_QUANTITY = 20;
function parsePositiveInt(value, fallback) {
    const parsed = parseInt(value || "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function normalizeProxyResponse(value) {
    if (Array.isArray(value))
        return value;
    if (value && typeof value === "object") {
        const maybeWrapped = value;
        if (Array.isArray(maybeWrapped.proxies))
            return maybeWrapped.proxies;
        return [value];
    }
    return [];
}
function normalizeProxyType(protocol) {
    const normalized = protocol?.toLowerCase();
    return normalized === "https" || normalized === "socks4" || normalized === "socks5"
        ? normalized
        : "http";
}
function normalizeQualityScore(proxy) {
    const raw = proxy.speed ?? proxy.quality_score ?? proxy.score;
    if (raw == null || !Number.isFinite(raw))
        return null;
    return Math.min(100, Math.max(0, Math.round(raw)));
}
export class ProxiflyProvider {
    id = "proxifly";
    name = "Proxifly";
    isEnabled() {
        return process.env.FREE_PROXY_PROXIFLY_ENABLED !== "false";
    }
    async sync() {
        if (!this.isEnabled()) {
            return { fetched: 0, added: 0, updated: 0, errors: ["Proxifly provider disabled"] };
        }
        const { upsertFreeProxy } = await import("./db-proxy.js");
        const quantity = parsePositiveInt(process.env.FREE_PROXY_PROXIFLY_QUANTITY, DEFAULT_QUANTITY);
        const anonymity = process.env.FREE_PROXY_PROXIFLY_ANONYMITY || DEFAULT_ANONYMITY;
        let countryFilter = (process.env.FREE_PROXY_COUNTRY_FILTER ?? "US").toUpperCase();
        const errors = [];
        let added = 0;
        let updated = 0;
        let fetched = 0;
        for (const protocol of DEFAULT_PROTOCOLS) {
            let requested = 0;
            try {
                while (requested < quantity) {
                    const batchQuantity = Math.min(MAX_BATCH_QUANTITY, quantity - requested);
                    const url = new URL(DEFAULT_API_URL);
                    url.searchParams.set("format", "json");
                    url.searchParams.set("quantity", String(batchQuantity));
                    url.searchParams.set("protocol", protocol);
                    url.searchParams.set("anonymity", anonymity);
                    if (countryFilter && countryFilter !== "ALL")
                        url.searchParams.set("country", countryFilter);
                    const res = await fetch(url, {
                        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
                    });
                    if (!res.ok) {
                        const text = await res.text().catch(() => "");
                        errors.push(`${protocol}: HTTP ${res.status}: ${text.slice(0, 100)}`);
                        break;
                    }
                    const proxies = normalizeProxyResponse(await res.json());
                    if (proxies.length === 0)
                        break;
                    requested += proxies.length;
                    for (const p of proxies) {
                        if (!p || !p.ip || !p.port)
                            continue;
                        if (isPrivateHost(p.ip))
                            continue;
                        const resolvedCountry = p.geolocation?.country?.slice(0, 2).toUpperCase() ||
                            p.country?.slice(0, 2).toUpperCase() ||
                            null;
                        if (countryFilter &&
                            countryFilter !== "ALL" &&
                            resolvedCountry &&
                            resolvedCountry !== countryFilter)
                            continue;
                        const item = {
                            source: "proxifly",
                            host: p.ip,
                            port: Number(p.port),
                            type: normalizeProxyType(p.protocol || protocol),
                            countryCode: resolvedCountry,
                            qualityScore: normalizeQualityScore(p),
                            latencyMs: null,
                            anonymity: p.anonymity || null,
                            lastValidated: new Date().toISOString(),
                        };
                        const r = await upsertFreeProxy(item);
                        if (r.action === "created")
                            added++;
                        else if (r.action === "updated")
                            updated++;
                        if (r.action !== "skipped")
                            fetched++;
                    }
                    if (proxies.length < batchQuantity)
                        break;
                }
            }
            catch (err) {
                errors.push(`${protocol}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        return { fetched, added, updated, errors };
    }
    async list(filters) {
        const { listFreeProxiesBySource } = await import("./db-proxy.js");
        return listFreeProxiesBySource("proxifly", filters);
    }
}
//# sourceMappingURL=proxifly.js.map