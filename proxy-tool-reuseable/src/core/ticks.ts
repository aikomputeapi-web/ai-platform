import type { DbAdapter, Logger, AlertSink, FailureFeed, ProxyProbe } from "../adapters.js";
import type { JobSettings, PromotionCandidate } from "../types.js";
import type { FreeProxyProvider } from "../providers/types.js";
import { testProxyMultiTarget } from "./probe.js";
import { promoteProxyToGlobal, demoteTier3Proxy } from "./promoteDemote.js";

const DEFAULT_LIVE_FAIL_THRESHOLD = 3;
const LIVE_FAIL_WINDOW_MS = 5 * 60 * 1000;
const LOW_POOL_THRESHOLD = 3;
let lastLowPoolAlertAt = 0;
const LOW_POOL_ALERT_COOLDOWN_MS = 15 * 60 * 1000;

const PROXY_NAME_PREFIX = "auto-us";

function computeQualityScore(latencyMs: number | null): number {
  if (!latencyMs) return 60;
  const timeoutSec = latencyMs / 1000;
  if (timeoutSec <= 0.1) return 95;
  if (timeoutSec <= 0.5) return 85;
  if (timeoutSec <= 1.0) return 75;
  if (timeoutSec <= 2.0) return 65;
  if (timeoutSec <= 5.0) return 50;
  if (timeoutSec <= 10.0) return 35;
  return 20;
}

export interface TickDeps {
  db: DbAdapter;
  log: Logger;
  alerts: AlertSink;
  failures: FailureFeed;
  probe: ProxyProbe;
  providers: FreeProxyProvider[];
  distribute?: () => Promise<void>;
}

export async function runFreeProxyCheckTick(
  deps: TickDeps,
  settings?: JobSettings
): Promise<void> {
  const log = deps.log;
  const settings_ = settings ?? deps.db as any;

  log.info("Free proxy check tick started");

  let liveFailures: Map<string, number>;
  try {
    liveFailures = deps.failures.recentFailures(LIVE_FAIL_WINDOW_MS);
    if (liveFailures.size > 0) {
      log.info(
        { failingProxies: liveFailures.size, windowMs: LIVE_FAIL_WINDOW_MS },
        "Found proxies with recent real-request failures"
      );
    }
  } catch (err) {
    liveFailures = new Map();
    log.warn({ err }, "Failed to read recent proxy failures (non-fatal)");
  }

  const liveFailThreshold = settings?.liveFailThreshold ?? DEFAULT_LIVE_FAIL_THRESHOLD;
  const countryFilter = settings?.countryFilter ?? "US";

  // Tier 2 demote threshold, used to pre-seed consecutive_failures when
  // demoting a Tier 3 proxy to Tier 2 so that the very next failure in Tier 2
  // trips the Tier 2 → Tier 1 rule ("if it immediately fails again → Tier 1").
  const tier2DemoteThreshold = settings?.tier2DemoteThreshold ?? 3;
  // Seeds Tier 2 consecutive_failures to (threshold - 1); one more failure → demote.
  const tier3DemoteFailureHeadStart = Math.max(0, tier2DemoteThreshold - 1);

  // Tier 3 (global pool / active proxies) — a single failure demotes the
  // proxy to Tier 2, with consecutive_failures pre-seeded so that another
  // failure on its next scheduled Tier 2 check drops it to Tier 1.
  try {
    const poolProxies = await deps.db.listGlobalPool();

    if (poolProxies.length > 0) {
      log.info({ count: poolProxies.length }, "Testing Tier 3 (active global pool) proxies");

      const chunk = <T>(arr: T[], size: number): T[][] =>
        Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
          arr.slice(i * size, i * size + size)
        );

      const chunks = chunk(poolProxies, 50);
      for (const batch of chunks) {
        await Promise.all(
          batch.map(async (pp) => {
            const key = `${pp.host}:${pp.port}`;
            if ((liveFailures.get(key) ?? 0) >= liveFailThreshold) {
              await demoteTier3Proxy(
                deps.db,
                log,
                pp.registryId,
                pp.host,
                2,
                tier3DemoteFailureHeadStart
              );
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
                await demoteTier3Proxy(
                  deps.db,
                  log,
                  pp.registryId,
                  pp.host,
                  2,
                  tier3DemoteFailureHeadStart
                );
                await deps.alerts.emit({
                  type: "proxy.demoted",
                  tier: 3,
                  host: pp.host,
                  port: pp.port,
                  reason: "liveness-failed",
                });
              }
            } catch {
              await demoteTier3Proxy(
                deps.db,
                log,
                pp.registryId,
                pp.host,
                2,
                tier3DemoteFailureHeadStart
              );
            }
          })
        );
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
  } catch (err) {
    log.warn({ err }, "Tier 3 validation failed (non-fatal)");
  }

  // Tier 2 (middle pool) — demote to Tier 1 on failure streak
  try {
    const tier2Proxies = await deps.db.listTier(2, countryFilter);

    if (tier2Proxies.length > 0) {
      log.info({ count: tier2Proxies.length }, "Testing Tier 2 (verified waiting pool) proxies");

      const tier2PromoteThreshold = settings?.tier2PromoteThreshold ?? 10;
      const tier2DemoteThreshold = settings?.tier2DemoteThreshold ?? 3;

      // Proxies that earned promotion to Tier 3 on this tick. Collected then
      // promoted sequentially below to avoid concurrent slot races inside
      // promoteToGlobalCandidate (which re-reads the live pool + allocates a
      // free global slot).
      const promotionQueue: PromotionCandidate[] = [];

      const chunk = <T>(arr: T[], size: number): T[][] =>
        Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
          arr.slice(i * size, i * size + size)
        );

      const chunks = chunk(tier2Proxies, 50);
      for (const batch of chunks) {
        await Promise.all(
          batch.map(async (item) => {
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
                const newSuccessCount = item.consecutive_successes + 1;
                if (newSuccessCount >= tier2PromoteThreshold) {
                  // Eligible for promotion to Tier 3 (active global pool).
                  promotionQueue.push({
                    id: item.id,
                    type: item.type,
                    host: item.host,
                    port: item.port,
                    quality_score: quality,
                    latency_ms: latencyMs,
                  });
                }
              } else {
                const newFailCount = item.consecutive_failures + 1;
                await deps.db.recordTestResult(item.id, false, latencyMs, quality);
                if (newFailCount >= tier2DemoteThreshold) {
                  await deps.db.setTier(item.id, 1);
                  await deps.db.resetCounters(item.id);
                  log.info({ host: item.host }, "Tier 2 proxy demoted to Tier 1 (failure streak)");
                  await deps.alerts.emit({
                    type: "proxy.demoted",
                    tier: 2,
                    host: item.host,
                    port: item.port,
                    reason: "failure-streak",
                  });
                }
              }
            } catch (err) {
              await deps.db.recordTestResult(item.id, false, null, 0);
              const newFailCount = item.consecutive_failures + 1;
              if (newFailCount >= tier2DemoteThreshold) {
                await deps.db.setTier(item.id, 1);
                await deps.db.resetCounters(item.id);
                log.info({ host: item.host }, "Tier 2 proxy demoted to Tier 1 (error streak)");
              }
            }
          })
        );
      }

      // Promote accumulated Tier 2 winners to the active global pool (Tier 3).
      // Capped at poolSize so a large backlog can't overflow the global pool
      // in a single tick — sync tick keeps topping it up otherwise.
      const maxPromotions = Math.min(
        promotionQueue.length,
        Math.max(1, settings?.poolSize ?? 20)
      );
      for (let i = 0; i < maxPromotions; i++) {
        const candidate = promotionQueue[i];
        try {
          // Skip if already in the global pool for this host:port.
          const existing = (await deps.db.listGlobalPool()).find(
            (p) => p.host === candidate.host && p.port === candidate.port
          );
          if (existing) continue;

          await promoteProxyToGlobal(
            deps.db,
            log,
            candidate,
            // Prefer the stored country code, else fall back to the country filter.
            (() => {
              const row = tier2Proxies.find((p) => p.id === candidate.id);
              return row?.country_code || settings?.countryFilter || "US";
            })(),
            settings?.poolSize ?? 20,
            PROXY_NAME_PREFIX
          );
          await deps.db.resetCounters(candidate.id);
          await deps.alerts.emit({
            type: "proxy.promoted",
            tier: 3,
            host: candidate.host,
            port: candidate.port,
            reason: "consecutive-successes",
          });
        } catch (err) {
          log.warn({ err, host: candidate.host }, "Tier 2 → Tier 3 promotion failed (non-fatal)");
        }
      }

      if (promotionQueue.length > 0) {
        log.info(
          { eligible: promotionQueue.length, promoted: maxPromotions },
          "Tier 2 → Tier 3 promotion pass complete"
        );
      }
    }
  } catch (err) {
    log.warn({ err }, "Tier 2 proxy testing failed (non-fatal)");
  }

  // Tier 1 (bottom pool) — promote to Tier 2 on success streak, delete on 5 consecutive failures
  try {
    const tier1Proxies = await deps.db.listTier(1, countryFilter);

    if (tier1Proxies.length > 0) {
      log.info({ count: tier1Proxies.length }, "Testing Tier 1 (bottom pool) proxies");

      const chunk = <T>(arr: T[], size: number): T[][] =>
        Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
          arr.slice(i * size, i * size + size)
        );

      const chunks = chunk(tier1Proxies, 50);
      for (const batch of chunks) {
        await Promise.all(
          batch.map(async (item) => {
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
              } else {
                await deps.db.recordTestResult(item.id, false, latencyMs, quality);
                const newFailCount = item.consecutive_failures + 1;
                if (newFailCount >= 5) {
                  await deps.db.delete(item.id);
                  log.info({ host: item.host }, "Tier 1 proxy deleted (5 consecutive failures)");
                }
              }
            } catch {
              await deps.db.recordTestResult(item.id, false, null, 0);
              const newFailCount = item.consecutive_failures + 1;
              if (newFailCount >= 5) {
                await deps.db.delete(item.id);
                log.info({ host: item.host }, "Tier 1 proxy deleted (5 consecutive failures)");
              }
            }
          })
        );
      }
    }
  } catch (err) {
    log.warn({ err }, "Tier 1 proxy testing failed (non-fatal)");
  }

  log.info("Free proxy check tick finished");
}

export async function runFreeProxySyncTick(
  deps: TickDeps,
  settings?: JobSettings
): Promise<void> {
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
  } catch (err) {
    log.warn({ err }, "Failed to delete non-matching country free proxies (non-fatal)");
  }

  // Step 3: Promote best Tier 2 proxies to Tier 3 (global pool)
  try {
    const candidateLimit = (settings?.poolSize ?? 20) * 2;
    const candidates = await deps.db.listPromotionCandidates(
      settings?.countryFilter ?? "ALL",
      settings?.minTests ?? 5,
      settings?.minQuality ?? 40,
      candidateLimit
    );

    if (candidates.length === 0) {
      log.info("No eligible Tier 2 proxies found for promotion — global pool unchanged");
    } else {
      const testResults = await Promise.all(
        candidates.slice(0, 30).map(async (row) => {
          const url = `${row.type}://${row.host}:${row.port}`;
          const { ok } = await testProxyMultiTarget(deps.probe, url, 5000);
          return { row, ok };
        })
      );

      const alive = testResults.filter((r) => r.ok).map((r) => r.row);
      log.info(
        { tested: candidates.length, alive: alive.length },
        "Liveness test complete for Tier 2 → Tier 3 promotion candidates"
      );

      for (const candidate of alive.slice(0, settings?.poolSize ?? 20)) {
        await promoteProxyToGlobal(
          deps.db,
          log,
          candidate,
          settings?.countryFilter ?? "US",
          settings?.poolSize ?? 20,
          PROXY_NAME_PREFIX
        );
      }

      log.info(
        { promoted: Math.min(alive.length, settings?.poolSize ?? 20) },
        "Promoted Tier 2 proxies to Tier 3 (global pool)"
      );
    }
  } catch (err) {
    log.warn({ err }, "Tier 2 → Tier 3 promotion failed (non-fatal)");
  }

  // Step 4: Auto-distribute (optional hook)
  if (settings?.autoDistribute && deps.distribute) {
    try {
      await deps.distribute();
    } catch (err) {
      log.warn({ err }, "Auto-distribute Tier 3 proxies failed (non-fatal)");
    }
  }

  log.info("Free proxy sync tick finished");
}

async function syncFreeProxySources(deps: TickDeps): Promise<void> {
  const log = deps.log;
  const providers = deps.providers.filter((p) => p.isEnabled());

  if (providers.length === 0) {
    log.info("No free proxy providers enabled — skipping sync");
    return;
  }

  for (const provider of providers) {
    try {
      const result = await provider.sync();
      log.info(
        {
          provider: provider.id,
          fetched: result.fetched,
          added: result.added,
          updated: result.updated,
          errors: result.errors.length,
        },
        "Provider sync complete"
      );
      if (result.errors.length > 0) {
        log.debug({ provider: provider.id, errors: result.errors }, "Provider sync had errors");
      }
    } catch (err) {
      log.warn({ err, provider: provider.id }, "Provider sync threw unexpectedly");
    }
  }
}
