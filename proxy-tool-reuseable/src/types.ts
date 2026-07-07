export type Tier = 1 | 2 | 3;

export interface FreeProxyRow {
  id: string;
  tier: Tier;
  type: string;
  host: string;
  port: number;
  country_code: string | null;
  in_pool: 0 | 1;
  consecutive_successes: number;
  consecutive_failures: number;
  test_count: number;
  success_count: number;
  quality_score: number | null;
  latency_ms: number | null;
}

export interface GlobalPoolRow {
  registryId: string;
  type: string;
  host: string;
  port: number;
}

export interface PromotionCandidate {
  id: string;
  type: string;
  host: string;
  port: number;
  quality_score: number | null;
  latency_ms: number | null;
}

export interface JobSettings {
  enabled: boolean;
  checkIntervalMs: number;
  syncIntervalMs: number;
  countryFilter: string | "ALL";
  minQuality: number;
  minTests: number;
  minSuccessRate: number;
  autoElevate: boolean;
  poolSize: number;
  autoRemoveDead: boolean;

  /**
   * Consecutive successful tests a Tier 1 proxy must accumulate before it is
   * promoted to Tier 2 (the verified/waiting pool). Default: 5.
   */
  tier1PromoteThreshold: number;

  /**
   * Consecutive successful tests a Tier 2 proxy must accumulate before it is
   * promoted to Tier 3 (the active global pool). Default: 10.
   */
  tier2PromoteThreshold: number;

  /**
   * Consecutive failed tests a Tier 2 proxy may accumulate before it is
   * demoted back to Tier 1. Default: 3.
   */
  tier2DemoteThreshold: number;

  liveFailThreshold: number;
  autoDistribute: boolean;
}

export type ProxyPoolAlert =
  | { type: "proxy.demoted"; tier: Tier; host: string; port: number; reason: string; failures?: number }
  | { type: "proxy.promoted"; tier: Tier; host: string; port: number; reason: string }
  | { type: "proxy.pool-low"; liveCount: number; threshold: number };

export interface ProxyShape {
  type: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
}
