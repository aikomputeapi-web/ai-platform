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
const DEFAULT_API_URL = "https://proxylist.geonode.com/api/proxy/list";
const DEFAULT_MAX = 500;
const DEFAULT_TIMEOUT_MS = 15000;
export class IplocateProvider {
    id = "iplocate";
    name = "IPLocate";
    isEnabled() {
        return process.env.FREE_PROXY_IPLOCATE_ENABLED !== "false";
    }
    getConfig() {
        return {
            apiUrl: process.env.FREE_PROXY_IPLOCATE_BASE_URL || DEFAULT_API_URL,
            maxProxies: parseInt(process.env.FREE_PROXY_IPLOCATE_MAX || "", 10) || DEFAULT_MAX,
        };
    }
    async sync() {
        if (!this.isEnabled()) {
            return { fetched: 0, added: 0, updated: 0, errors: ["IPLocate provider disabled"] };
        }
        const { upsertFreeProxy } = await import("./db-proxy.js");
        const { apiUrl, maxProxies } = this.getConfig();
        let countryFilter = "";
        countryFilter = (process.env.FREE_PROXY_COUNTRY_FILTER ?? "US").toUpperCase();
        const errors = [];
        let added = 0;
        let updated = 0;
        let fetched = 0;
        try {
            const params = new URLSearchParams({
                limit: String(Math.min(maxProxies, 500)),
                page: "1",
                sort_by: "speed",
                sort_type: "asc",
                speeds: "fastest",
            });
            if (countryFilter && countryFilter !== "ALL") {
                params.set("country", countryFilter);
            }
            const url = `${apiUrl}?${params.toString()}`;
            const res = await fetch(url, { signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                errors.push(`HTTP ${res.status}: ${text.slice(0, 100)}`);
                return { fetched: 0, added: 0, updated: 0, errors };
            }
            const json = (await res.json());
            if (!Array.isArray(json.data)) {
                errors.push("Invalid response format");
                return { fetched: 0, added: 0, updated: 0, errors };
            }
            for (const p of json.data) {
                if (!p.ip || !p.port || isPrivateHost(p.ip)) {
                    errors.push(`geonode: skipped invalid/private host ${p.ip}`);
                    continue;
                }
                const protocols = p.protocols || ["http"];
                for (const proto of protocols) {
                    const normalizedType = proto.toLowerCase() === "https" ? "https" :
                        proto.toLowerCase() === "socks5" ? "socks5" :
                            proto.toLowerCase() === "socks4" ? "socks4" : "http";
                    const item = {
                        source: "iplocate",
                        host: p.ip,
                        port: Number(p.port),
                        type: normalizedType,
                        countryCode: p.country?.slice(0, 2).toUpperCase() || null,
                        qualityScore: p.speed ? Math.min(100, Math.max(0, Math.round((1 - p.speed / 10000) * 100))) : 50,
                        latencyMs: p.speed ?? null,
                        anonymity: p.anonymityLevel || null,
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
            }
        }
        catch (err) {
            errors.push(err instanceof Error ? err.message : String(err));
        }
        return { fetched, added, updated, errors };
    }
    async list(filters) {
        const { listFreeProxiesBySource } = await import("./db-proxy.js");
        return listFreeProxiesBySource("iplocate", filters);
    }
}
//# sourceMappingURL=iplocate.js.map