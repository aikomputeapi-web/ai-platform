export { createFreeProxyPool } from "./core/pool.js";
export type { FreeProxyPool, FreeProxyPoolOptions } from "./core/pool.js";

export type {
  DbAdapter,
  Logger,
  SettingsStore,
  AlertSink,
  FailureFeed,
  ProxyProbe,
  CandidateSource,
} from "./adapters.js";

export type {
  Tier,
  FreeProxyRow,
  GlobalPoolRow,
  PromotionCandidate,
  JobSettings,
  ProxyPoolAlert,
  ProxyShape,
} from "./types.js";
