import { createFreeProxyPool } from "../src/core/pool.js";
import { createConsoleLogger } from "../src/adapters/console-logger.js";
import { createInMemorySettingsStore } from "../src/adapters/in-memory-settings.js";
import { createRingBufferFailureFeed } from "../src/adapters/ring-buffer-failures.js";
import { createUndiciProbe } from "../src/adapters/undici-probe.js";
import type { DbAdapter, AlertSink } from "../src/adapters.js";

function createNoopDb(): DbAdapter {
  const store = new Map<string, Record<string, unknown>>();
  return {
    async listTier() { return []; },
    async listGlobalPool() { return []; },
    async countGlobalPool() { return 0; },
    async listPromotionCandidates() { return []; },
    async recordTestResult() {},
    async setTier() {},
    async resetCounters() {},
    async delete() {},
    async demoteFromGlobalPool() {},
    async promoteToGlobalCandidate() {},
    async deleteNonMatchingCountry() { return 0; },
  };
}

const noopAlerts: AlertSink = {
  async emit() {},
};

async function main() {
  const pool = createFreeProxyPool({
    db: createNoopDb(),
    log: createConsoleLogger({ prefix: "test", level: "debug" }),
    settings: createInMemorySettingsStore({
      enabled: true,
      checkIntervalMs: 1000,
      syncIntervalMs: 30000,
    }),
    alerts: noopAlerts,
    failures: createRingBufferFailureFeed(),
    probe: createUndiciProbe(),
    providers: [],
  });

  pool.start();
  console.log("Pool started");

  // Let one check tick run
  await new Promise((r) => setTimeout(r, 200));

  pool.stop();
  console.log("Pool stopped");
  console.log("Smoke test PASSED");
}

main().catch((err) => {
  console.error("Smoke test FAILED:", err);
  process.exit(1);
});
