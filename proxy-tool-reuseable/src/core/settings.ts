import type { JobSettings } from "../types.js";

const DEFAULT_LIVE_FAIL_THRESHOLD = 3;

export const DEFAULT_JOB_SETTINGS: JobSettings = {
  enabled: process.env.FREE_PROXY_AUTO_JOB_ENABLED !== "false",
  checkIntervalMs: 10 * 60 * 1000,
  syncIntervalMs: 30 * 60 * 1000,
  countryFilter: (process.env.FREE_PROXY_COUNTRY_FILTER || "US").toUpperCase(),
  minQuality: 40,
  minTests: 5,
  minSuccessRate: 100,
  autoElevate: true,
  poolSize: 20,
  autoRemoveDead: true,
  tier1PromoteThreshold: 5,
  tier2DemoteThreshold: 2,
  liveFailThreshold: DEFAULT_LIVE_FAIL_THRESHOLD,
  autoDistribute: process.env.FREE_PROXY_AUTO_DISTRIBUTE === "true",
};

export function getSettingsHash(s: JobSettings): string {
  return `${s.enabled}:${s.checkIntervalMs}:${s.syncIntervalMs}:${s.countryFilter}:${s.minQuality}:${s.minTests}:${s.minSuccessRate}:${s.autoElevate}:${s.tier1PromoteThreshold}:${s.tier2DemoteThreshold}`;
}
