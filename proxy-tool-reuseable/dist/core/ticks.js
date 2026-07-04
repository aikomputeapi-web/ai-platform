import { testProxyMultiTarget } from "./probe.js";
import { promoteProxyToGlobal } from "./promoteDemote.js";
const DEFAULT_LIVE_FAIL_THRESHOLD = 3;
const LIVE_FAIL_WINDOW_MS = 5 * 60 * 1000;
const LOW_POOL_THRESHOLD = 3;
let lastLowPoolAlertAt = 0;
const LOW_POOL_ALERT_COOLDOWN_MS = 15 * 60 * 1000;
const PROXY_NAME_PREFIX = "auto-us";
function computeQualityScore(latencyMs) {
    if (!latencyMs)
        return 60;
    const timeoutSec = latencyMs / 1000;
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
export async function runFreeProxyCheckTick(deps, settings) {
    const log = deps.log;
    const settings_ = settings ?? deps.db;
    log.info("Free proxy check tick started");
    let liveFailures;
    try {
        liveFailures = deps.failures.recentFailures(LIVE_FAIL_WINDOW_MS);
        if (liveFailures.size > 0) {
            log.info({ failingProxies: liveFailures.size, windowMs: LIVE_FAIL_WINDOW_MS }, "Found proxies with recent real-request failures");
        }
    }
    catch (err) {
        liveFailures = new Map();
        log.warn({ err }, "Failed to read recent proxy failures (non-fatal)");
    }
    const liveFailThreshold = settings?.liveFailThreshold ?? DEFAULT_LIVE_FAIL_THRESHOLD;
    const countryFilter = settings?.countryFilter ?? "US";
    // Tier 3 (global pool) — any failure = demote to Tier 1
    try {
        const poolProxies = await deps.db.listGlobalPool();
        if (poolProxies.length > 0) {
            log.info({ count: poolProxies.length }, "Testing Tier 3 (global pool) proxies");
            const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
            const chunks = chunk(poolProxies, 50);
            for (const batch of chunks) {
                await Promise.all(batch.map(async (pp) => {
                    const key = `${pp.host}:${pp.port}`;
                    if ((liveFailures.get(key) ?? 0) >= liveFailThreshold) {
                        await deps.db.demoteFromGlobalPool(pp.registryId, pp.host);
                        await deps.alerts.emit({
                            type: "proxy.demoted",
                            tier: 3,
                            host: pp.host,
                            port: pp.port,
                            reason: "live-request-failures",
                            failures: liveFailures.get(key),
                        });
                        return;
                    }
                    try {
                        const url = `${pp.type}://${pp.host}:${pp.port}`;
                        const { ok } = await testProxyMultiTarget(deps.probe, url, 5000);
                        if (!ok) {
                            await deps.db.demoteFromGlobalPool(pp.registryId, pp.host);
                            await deps.alerts.emit({
                                type: "proxy.demoted",
                                tier: 3,
                                host: pp.host,
                                port: pp.port,
                                reason: "liveness-failed",
                            });
                        }
                    }
                    catch {
                        await deps.db.demoteFromGlobalPool(pp.registryId, pp.host);
                    }
                }));
            }
            const remaining = await deps.db.countGlobalPool();
            if (remaining < LOW_POOL_THRESHOLD && Date.now() - lastLowPoolAlertAt > LOW_POOL_ALERT_COOLDOWN_MS) {
                lastLowPoolAlertAt = Date.now();
                log.warn({ liveCount: remaining, threshold: LOW_POOL_THRESHOLD }, "Live proxy pool below threshold");
                await deps.alerts.emit({
                    type: "proxy.pool-low",
                    liveCount: remaining,
                    threshold: LOW_POOL_THRESHOLD,
                });
            }
        }
    }
    catch (err) {
        log.warn({ err }, "Tier 3 validation failed (non-fatal)");
    }
    // Tier 2 (middle pool) — demote to Tier 1 on failure streak
    try {
        const tier2Proxies = await deps.db.listTier(2, countryFilter);
        if (tier2Proxies.length > 0) {
            log.info({ count: tier2Proxies.length }, "Testing Tier 2 (middle pool) proxies");
            const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
            const chunks = chunk(tier2Proxies, 50);
            for (const batch of chunks) {
                await Promise.all(batch.map(async (item) => {
                    const key = `${item.host}:${item.port}`;
                    if ((liveFailures.get(key) ?? 0) >= liveFailThreshold) {
                        await deps.db.setTier(item.id, 1);
                        await deps.db.resetCounters(item.id);
                        log.info({ host: item.host }, "Tier 2 proxy demoted to Tier 1 (live-request failures)");
                        await deps.alerts.emit({
                            type: "proxy.demoted",
                            tier: 2,
                            host: item.host,
                            port: item.port,
                            reason: "live-request-failures",
                        });
                        return;
                    }
                    const url = `${item.type}://${item.host}:${item.port}`;
                    try {
                        const { ok, latencyMs } = await testProxyMultiTarget(deps.probe, url, 5000);
                        const quality = computeQualityScore(latencyMs);
                        if (ok) {
                            await deps.db.recordTestResult(item.id, true, latencyMs, quality);
                        }
                        else {
                            const newFailCount = item.consecutive_failures + 1;
                            await deps.db.recordTestResult(item.id, false, latencyMs, quality);
                            if (newFailCount >= (settings?.tier2DemoteThreshold ?? 2)) {
                                await deps.db.setTier(item.id, 1);
                                await deps.db.resetCounters(item.id);
                                log.info({ host: item.host }, "Tier 2 proxy demoted to Tier 1 (failure streak)");
                            }
                        }
                    }
                    catch (err) {
                        await deps.db.recordTestResult(item.id, false, null, 0);
                        const newFailCount = item.consecutive_failures + 1;
                        if (newFailCount >= (settings?.tier2DemoteThreshold ?? 2)) {
                            await deps.db.setTier(item.id, 1);
                            await deps.db.resetCounters(item.id);
                            log.info({ host: item.host }, "Tier 2 proxy demoted to Tier 1 (error streak)");
                        }
                    }
                }));
            }
        }
    }
    catch (err) {
        log.warn({ err }, "Tier 2 proxy testing failed (non-fatal)");
    }
    // Tier 1 (bottom pool) — promote to Tier 2 on success streak, delete on 5 consecutive failures
    try {
        const tier1Proxies = await deps.db.listTier(1, countryFilter);
        if (tier1Proxies.length > 0) {
            log.info({ count: tier1Proxies.length }, "Testing Tier 1 (bottom pool) proxies");
            const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
            const chunks = chunk(tier1Proxies, 50);
            for (const batch of chunks) {
                await Promise.all(batch.map(async (item) => {
                    const key = `${item.host}:${item.port}`;
                    if ((liveFailures.get(key) ?? 0) >= liveFailThreshold) {
                        await deps.db.delete(item.id);
                        log.info({ host: item.host }, "Tier 1 proxy removed (live-request failures)");
                        return;
                    }
                    const url = `${item.type}://${item.host}:${item.port}`;
                    try {
                        const { ok, latencyMs } = await testProxyMultiTarget(deps.probe, url, 5000);
                        const quality = computeQualityScore(latencyMs);
                        if (ok) {
                            await deps.db.recordTestResult(item.id, true, latencyMs, quality);
                            const newSuccessCount = item.consecutive_successes + 1;
                            if (newSuccessCount >= (settings?.tier1PromoteThreshold ?? 5)) {
                                await deps.db.setTier(item.id, 2);
                                await deps.db.resetCounters(item.id);
                                log.info({ host: item.host }, "Tier 1 proxy promoted to Tier 2 (success streak)");
                            }
                        }
                        else {
                            await deps.db.recordTestResult(item.id, false, latencyMs, quality);
                            const newFailCount = item.consecutive_failures + 1;
                            if (newFailCount >= 5) {
                                await deps.db.delete(item.id);
                                log.info({ host: item.host }, "Tier 1 proxy deleted (5 consecutive failures)");
                            }
                        }
                    }
                    catch {
                        await deps.db.recordTestResult(item.id, false, null, 0);
                        const newFailCount = item.consecutive_failures + 1;
                        if (newFailCount >= 5) {
                            await deps.db.delete(item.id);
                            log.info({ host: item.host }, "Tier 1 proxy deleted (5 consecutive failures)");
                        }
                    }
                }));
            }
        }
    }
    catch (err) {
        log.warn({ err }, "Tier 1 proxy testing failed (non-fatal)");
    }
    log.info("Free proxy check tick finished");
}
export async function runFreeProxySyncTick(deps, settings) {
    const log = deps.log;
    log.info("Free proxy sync tick started");
    const settings_ = settings ?? DEFAULT_LIVE_FAIL_THRESHOLD;
    // Step 1: Sync sources
    await syncFreeProxySources(deps);
    // Step 2: Delete non-matching country proxies
    try {
        if (settings?.countryFilter && settings.countryFilter !== "ALL") {
            const deleted = await deps.db.deleteNonMatchingCountry(settings.countryFilter);
            if (deleted > 0) {
                log.info({ deleted }, "Cleaned up non-matching country free proxies");
            }
        }
    }
    catch (err) {
        log.warn({ err }, "Failed to delete non-matching country free proxies (non-fatal)");
    }
    // Step 3: Promote best Tier 2 proxies to Tier 3 (global pool)
    try {
        const candidateLimit = (settings?.poolSize ?? 20) * 2;
        const candidates = await deps.db.listPromotionCandidates(settings?.countryFilter ?? "ALL", settings?.minTests ?? 5, settings?.minQuality ?? 40, candidateLimit);
        if (candidates.length === 0) {
            log.info("No eligible Tier 2 proxies found for promotion — global pool unchanged");
        }
        else {
            const testResults = await Promise.all(candidates.slice(0, 30).map(async (row) => {
                const url = `${row.type}://${row.host}:${row.port}`;
                const { ok } = await testProxyMultiTarget(deps.probe, url, 5000);
                return { row, ok };
            }));
            const alive = testResults.filter((r) => r.ok).map((r) => r.row);
            log.info({ tested: candidates.length, alive: alive.length }, "Liveness test complete for Tier 2 → Tier 3 promotion candidates");
            for (const candidate of alive.slice(0, settings?.poolSize ?? 20)) {
                await promoteProxyToGlobal(deps.db, log, candidate, settings?.countryFilter ?? "US", settings?.poolSize ?? 20, PROXY_NAME_PREFIX);
            }
            log.info({ promoted: Math.min(alive.length, settings?.poolSize ?? 20) }, "Promoted Tier 2 proxies to Tier 3 (global pool)");
        }
    }
    catch (err) {
        log.warn({ err }, "Tier 2 → Tier 3 promotion failed (non-fatal)");
    }
    // Step 4: Auto-distribute (optional hook)
    if (settings?.autoDistribute && deps.distribute) {
        try {
            await deps.distribute();
        }
        catch (err) {
            log.warn({ err }, "Auto-distribute Tier 3 proxies failed (non-fatal)");
        }
    }
    log.info("Free proxy sync tick finished");
}
async function syncFreeProxySources(deps) {
    const log = deps.log;
    const providers = deps.providers.filter((p) => p.isEnabled());
    if (providers.length === 0) {
        log.info("No free proxy providers enabled — skipping sync");
        return;
    }
    for (const provider of providers) {
        try {
            const result = await provider.sync();
            log.info({
                provider: provider.id,
                fetched: result.fetched,
                added: result.added,
                updated: result.updated,
                errors: result.errors.length,
            }, "Provider sync complete");
            if (result.errors.length > 0) {
                log.debug({ provider: provider.id, errors: result.errors }, "Provider sync had errors");
            }
        }
        catch (err) {
            log.warn({ err, provider: provider.id }, "Provider sync threw unexpectedly");
        }
    }
}
//# sourceMappingURL=ticks.js.map