import { DEFAULT_JOB_SETTINGS, getSettingsHash } from "./settings.js";
import { runFreeProxyCheckTick, runFreeProxySyncTick } from "./ticks.js";
export function createFreeProxyPool(options) {
    let checkTimer;
    let syncTimer;
    let currentSettingsHash = "";
    let isCheckTickRunning = false;
    let isSyncTickRunning = false;
    let reloadInFlight = null;
    const log = options.log;
    async function resolveSettings() {
        try {
            const s = await options.settings.get();
            return s;
        }
        catch (err) {
            log.warn({ err }, "Failed to get settings, using defaults");
            return { ...DEFAULT_JOB_SETTINGS };
        }
    }
    const tickDeps = {
        db: options.db,
        log: options.log,
        alerts: options.alerts,
        failures: options.failures,
        probe: options.probe,
        providers: options.providers,
        distribute: options.distribute,
    };
    async function runCheckTickWithGuard() {
        if (isCheckTickRunning) {
            log.warn("Free proxy check tick skipped because a previous run is still in progress");
            return;
        }
        isCheckTickRunning = true;
        try {
            const settings = await resolveSettings();
            await runFreeProxyCheckTick(tickDeps, settings);
        }
        catch (err) {
            log.warn({ err }, "Free proxy check failed");
        }
        finally {
            isCheckTickRunning = false;
        }
    }
    async function runSyncTickWithGuard() {
        if (isSyncTickRunning) {
            log.warn("Free proxy sync tick skipped because a previous run is still in progress");
            return;
        }
        isSyncTickRunning = true;
        try {
            const settings = await resolveSettings();
            await runFreeProxySyncTick(tickDeps, settings);
        }
        catch (err) {
            log.warn({ err }, "Free proxy sync failed");
        }
        finally {
            isSyncTickRunning = false;
        }
    }
    async function reload() {
        if (reloadInFlight) {
            return reloadInFlight;
        }
        reloadInFlight = (async () => {
            const jobSettings = await resolveSettings();
            const newHash = getSettingsHash(jobSettings);
            if (newHash === currentSettingsHash) {
                return;
            }
            currentSettingsHash = newHash;
            stop();
            if (!jobSettings.enabled) {
                log.info("Free proxy background job is disabled");
                return;
            }
            log.info({
                checkIntervalMs: jobSettings.checkIntervalMs,
                syncIntervalMs: jobSettings.syncIntervalMs,
                countryFilter: jobSettings.countryFilter,
                minQuality: jobSettings.minQuality,
                tier1PromoteThreshold: jobSettings.tier1PromoteThreshold,
                tier2DemoteThreshold: jobSettings.tier2DemoteThreshold,
            }, "Scheduling 3-tier proxy check & sync background jobs");
            void runCheckTickWithGuard().catch((err) => log.warn({ err }, "Initial free proxy check failed"));
            checkTimer = setInterval(() => {
                void runCheckTickWithGuard().catch((err) => log.warn({ err }, "Free proxy check failed"));
            }, jobSettings.checkIntervalMs);
            checkTimer.unref();
            void runSyncTickWithGuard().catch((err) => log.warn({ err }, "Initial free proxy sync failed"));
            syncTimer = setInterval(() => {
                void runSyncTickWithGuard().catch((err) => log.warn({ err }, "Free proxy sync failed"));
            }, jobSettings.syncIntervalMs);
            syncTimer.unref();
        })().finally(() => {
            reloadInFlight = null;
        });
        return reloadInFlight;
    }
    function stop() {
        if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = undefined;
        }
        if (syncTimer) {
            clearInterval(syncTimer);
            syncTimer = undefined;
        }
        isCheckTickRunning = false;
        isSyncTickRunning = false;
    }
    function start() {
        void reload().catch((err) => log.warn({ err }, "Failed to start free proxy pool"));
    }
    async function findWorkingProxy(targetHostname, targetUrl) {
        if (!options.candidateSource)
            return null;
        const { findWorkingProxy: fwp } = await import("../fallback/findWorkingProxy.js");
        return fwp(options.candidateSource, options.probe, options.log, targetHostname, targetUrl);
    }
    return {
        start,
        stop,
        reload,
        runCheckTick: runCheckTickWithGuard,
        runSyncTick: runSyncTickWithGuard,
        findWorkingProxy,
    };
}
//# sourceMappingURL=pool.js.map