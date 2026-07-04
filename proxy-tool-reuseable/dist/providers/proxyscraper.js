import { readFile } from "fs/promises";
import { existsSync } from "fs";
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
const DEFAULT_MAX = 1000;
const DEFAULT_COUNTRY_FILTER = "US";
export class ProxyScraperProvider {
    id = "proxyscraper";
    name = "ProxyScraper";
    isEnabled() {
        return process.env.FREE_PROXY_SCRAPER_ENABLED !== "false";
    }
    async getConfig() {
        let countryFilter = (process.env.FREE_PROXY_COUNTRY_FILTER ?? DEFAULT_COUNTRY_FILTER).toUpperCase();
        const baseOutDir = "./proxy_scraper_data/out";
        const countrySubdir = `${baseOutDir}/proxies/${countryFilter}`;
        const useCountrySubdir = countryFilter !== "ALL" && existsSync(`${countrySubdir}/http.txt`);
        return {
            jsonFile: process.env.FREE_PROXY_SCRAPER_JSON_FILE || `${baseOutDir}/proxies.json`,
            httpFile: process.env.FREE_PROXY_SCRAPER_HTTP_FILE ||
                (useCountrySubdir ? `${countrySubdir}/http.txt` : `${baseOutDir}/http.txt`),
            socks4File: process.env.FREE_PROXY_SCRAPER_SOCKS4_FILE ||
                (useCountrySubdir ? `${countrySubdir}/socks4.txt` : `${baseOutDir}/socks4.txt`),
            socks5File: process.env.FREE_PROXY_SCRAPER_SOCKS5_FILE ||
                (useCountrySubdir ? `${countrySubdir}/socks5.txt` : `${baseOutDir}/socks5.txt`),
            maxProxies: parseInt(process.env.FREE_PROXY_SCRAPER_MAX || "", 10) || DEFAULT_MAX,
            countryCode: countryFilter === "ALL" ? null : countryFilter || null,
        };
    }
    latencyToQuality(timeoutSec) {
        if (timeoutSec <= 0.1)
            return 95;
        if (timeoutSec <= 0.5)
            return 85;
        if (timeoutSec <= 1.0)
            return 75;
        if (timeoutSec <= 2.0)
            return 65;
        if (timeoutSec <= 5.0)
            return 50;
        if (timeoutSec <= 10.0)
            return 35;
        return 20;
    }
    normalizeProtocol(protocol) {
        const p = protocol.toLowerCase();
        if (p === "socks4")
            return "socks4";
        if (p === "socks5")
            return "socks5";
        if (p === "https")
            return "https";
        return "http";
    }
    async syncFromJson(jsonPath, config) {
        const { upsertFreeProxy } = await import("./db-proxy.js");
        const errors = [];
        let added = 0;
        let updated = 0;
        let fetched = 0;
        let filtered = 0;
        const content = await readFile(jsonPath, "utf-8");
        let entries;
        try {
            entries = JSON.parse(content);
        }
        catch {
            return { fetched: 0, added: 0, updated: 0, errors: ["Invalid JSON in scraper output"] };
        }
        if (!Array.isArray(entries)) {
            return { fetched: 0, added: 0, updated: 0, errors: ["JSON is not an array"] };
        }
        fetched = entries.length;
        for (const entry of entries) {
            const isoCode = entry.geolocation?.country?.iso_code?.toUpperCase() ?? null;
            if (config.countryCode && isoCode !== config.countryCode) {
                filtered++;
                continue;
            }
            const host = entry.host;
            const port = entry.port;
            if (!host || !port || typeof port !== "number" || isPrivateHost(host)) {
                errors.push(`proxyscraper: skipped invalid/private host ${host}`);
                continue;
            }
            if (added + updated >= config.maxProxies)
                break;
            const latencyMs = typeof entry.timeout === "number" ? Math.round(entry.timeout * 1000) : null;
            const item = {
                source: "proxyscraper",
                host,
                port,
                type: this.normalizeProtocol(entry.protocol),
                countryCode: isoCode,
                qualityScore: typeof entry.timeout === "number" ? this.latencyToQuality(entry.timeout) : 60,
                latencyMs,
                anonymity: "anonymous",
                lastValidated: new Date().toISOString(),
            };
            const result = await upsertFreeProxy(item);
            if (result.action === "created")
                added++;
            else if (result.action === "updated")
                updated++;
        }
        if (filtered > 0) {
            errors.push(`Filtered out ${filtered} non-${config.countryCode} proxies (${fetched} total, ${fetched - filtered} matched)`);
        }
        return { fetched, added, updated, errors };
    }
    async syncFromTxtFiles(config) {
        const { upsertFreeProxy } = await import("./db-proxy.js");
        const errors = [];
        let added = 0;
        let updated = 0;
        let fetched = 0;
        const files = [
            { path: config.httpFile, type: "http" },
            { path: config.socks4File, type: "socks4" },
            { path: config.socks5File, type: "socks5" },
        ];
        for (const { path, type } of files) {
            try {
                if (!existsSync(path)) {
                    errors.push(`File not found: ${path}`);
                    continue;
                }
                const content = await readFile(path, "utf-8");
                const lines = content.split("\n").filter((line) => line.trim());
                const proxies = lines.slice(0, config.maxProxies);
                fetched += proxies.length;
                for (const line of proxies) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith("#"))
                        continue;
                    const [host, portStr] = trimmed.split(":");
                    const port = parseInt(portStr, 10);
                    if (!host || !port || isNaN(port) || isPrivateHost(host)) {
                        errors.push(`proxyscraper: skipped invalid/private host ${host}`);
                        continue;
                    }
                    const item = {
                        source: "proxyscraper",
                        host,
                        port,
                        type,
                        countryCode: config.countryCode,
                        qualityScore: 60,
                        latencyMs: null,
                        anonymity: "anonymous",
                        lastValidated: new Date().toISOString(),
                    };
                    const result = await upsertFreeProxy(item);
                    if (result.action === "created")
                        added++;
                    else if (result.action === "updated")
                        updated++;
                }
            }
            catch (err) {
                errors.push(`${type}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        return { fetched, added, updated, errors };
    }
    async sync() {
        if (!this.isEnabled()) {
            return { fetched: 0, added: 0, updated: 0, errors: ["ProxyScraper provider disabled"] };
        }
        const config = await this.getConfig();
        if (existsSync(config.jsonFile)) {
            return this.syncFromJson(config.jsonFile, config);
        }
        return this.syncFromTxtFiles(config);
    }
    async list(filters) {
        const { listFreeProxiesBySource } = await import("./db-proxy.js");
        return listFreeProxiesBySource("proxyscraper", filters);
    }
}
//# sourceMappingURL=proxyscraper.js.map