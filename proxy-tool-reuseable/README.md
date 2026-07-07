# @ai-platform/free-proxy-pool

Portable 3-tier free proxy pool manager extracted from [OmniRoute](https://github.com/diegosouzapw/OmniRoute).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        

## Quickstart

                                                                             settings: createInMemorySettingsStore({ enabled: true, checkIntervalMs: 60000 }),
  alerts: { emit: async (alert) => console.log("alert:", alert) },
  failures: createRingBufferFailureFeed(),
  probe: createUndiciProbe(),
  providers: [],
});

pool.start();
// ...
pool.stop();
```

## Architecture

Three-tier proxy pool:
- **Tier 1** — intake / entry point for all successful proxies found during scraping or
  checking. **5 consecutive successful tests** → promoted to Tier 2. **5 consecutive
  failures** → deleted.
- **Tier 2** — verified-working pool where proxies wait until needed or until they
  prove 100% solid. **10 more consecutive successful tests** → promoted to Tier 3
  (active pool). **3 consecutive failures** → demoted back to Tier 1 and starts the
  testing process over.
- **Tier 3** — active/in-use global pool (proxy_registry). **Any single failure**
  → moved to Tier 2. If that proxy **immediately fails again** (next scheduled check
  in Tier 2), it is demoted to Tier 1.

Automatic liveness testing runs every **5 minutes** (configurable via
`checkIntervalMinutes`) across all three tiers.

## Adapter Reference

| Adapter | Interface | Required | Default |
|---|---|---|---|
| `db` | `DbAdapter` | Yes | — |
| `log` | `Logger` | Yes | `createConsoleLogger()` |
| `settings` | `SettingsStore` | Yes | `createInMemorySettingsStore()` |
| `alerts` | `AlertSink` | Yes | — |
| `failures` | `FailureFeed` | Yes | `createRingBufferFailureFeed()` |
| `probe` | `ProxyProbe` | Yes | `createUndiciProbe()` |
| `providers` | `FreeProxyProvider[]` | Yes | — |
| `candidateSource` | `CandidateSource` | No | For fallback only |
| `distribute` | `() => Promise<void>` | No | Optional hook |

## Migrations

Run `migrations/001_init.sql` against your SQLite database to create the required tables:

```sh
sqlite3 /path/to/data.db < migrations/001_init.sql
```

## Porting from OmniRoute

Each adapter interface wraps a specific OmniRoute source:

| Adapter | OmniRoute Source |
|---|---|
| `DbAdapter` | SQL in `freeProxyJob.ts` + `db/freeProxies.ts` |
| `Logger` | `createLogger("free-proxy-job")` |
| `SettingsStore` | `getSettings()` reading `freeProxy*` keys |
| `AlertSink` | `dispatchEvent` for `proxy.demoted` / `proxy.pool-low` |
| `FailureFeed` | `getRecentProxyFailures` in `proxyLogger.ts` |
| `ProxyProbe` | `testSingleProxy` in `proxyFallback.ts` |
| `CandidateSource` | `getProxyCandidates` in `proxyFallback.ts` |
| `FreeProxyProvider` | `freeProxyProviders/types.ts` |

> **OmniRoute itself is NOT modified.** Wiring it to consume this package is a separate opt-in task.
