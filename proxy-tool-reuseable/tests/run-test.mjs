import { createFreeProxyPool } from "../dist/index.js";
import { createConsoleLogger } from "../dist/adapters/console-logger.js";
import { createInMemorySettingsStore } from "../dist/adapters/in-memory-settings.js";
import { createRingBufferFailureFeed } from "../dist/adapters/ring-buffer-failures.js";
import { createUndiciProbe } from "../dist/adapters/undici-probe.js";

function createNoopDb() {
  return {
    listTier: async () => [],
    listGlobalPool: async () => [],
    countGlobalPool: async () => 0,
    listPromotionCandidates: async () => [],
    recordTestResult: async () => {},
    setTier: async () => {},
    resetCounters: async () => {},
    delete: async () => {},
    demoteFromGlobalPool: async () => {},
    demoteFromGlobalPoolToTier: async () => {},
    promoteToGlobalCandidate: async () => {},
    deleteNonMatchingCountry: async () => 0,
  };
}

const noopAlerts = { emit: async () => {} };

async function main() {
  const pool = createFreeProxyPool({
    db: createNoopDb(),
    log: createConsoleLogger({ prefix: "test", level: "debug" }),
    settings: createInMemorySettingsStore({ enabled: true, checkIntervalMs: 1000, syncIntervalMs: 30000 }),
    alerts: noopAlerts,
    failures: createRingBufferFailureFeed(),
    probe: createUndiciProbe(),
    providers: [],
  });

  pool.start();
  console.log("Pool started");
  await new Promise((r) => setTimeout(r, 200));
  pool.stop();
  console.log("Pool stopped");
  console.log("Smoke test PASSED");
}

main().catch((err) => {
  console.error("Smoke test FAILED:", err);
  process.exit(1);
});
