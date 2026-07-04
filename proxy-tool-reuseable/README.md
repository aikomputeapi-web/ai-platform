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
- **Tier 1** — freshly scraped, untested. Failure → delete, 5 consecutive successes → Tier 2.
- **Tier 2** — verified-working. Failure streak → Tier 1. High quality + low latency → Tier 3.
- **Tier 3** — global pool (proxy_registry). Any failure → Tier 2.

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
