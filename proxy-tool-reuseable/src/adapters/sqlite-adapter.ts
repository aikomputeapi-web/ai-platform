import type { DbAdapter, Logger } from "../adapters.js";
import type { FreeProxyRow, GlobalPoolRow, PromotionCandidate } from "../types.js";

export interface SqliteDb {
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number };
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
    transaction<T>(fn: () => T): T;
  };
  exec(sql: string): void;
}

export function createSqliteAdapter(
  db: SqliteDb,
  log: Logger,
  namePrefix = "auto-us"
): DbAdapter {
  function rowToFreeProxyRow(r: Record<string, unknown>): FreeProxyRow {
    return {
      id: String(r.id ?? ""),
      tier: (r.tier ?? 1) as 1 | 2 | 3,
      type: String(r.type ?? "http"),
      host: String(r.host ?? ""),
      port: Number(r.port) || 0,
      country_code: r.country_code != null ? String(r.country_code) : null,
      in_pool: (r.in_pool ?? 0) as 0 | 1,
      consecutive_successes: Number(r.consecutive_successes ?? 0),
      consecutive_failures: Number(r.consecutive_failures ?? 0),
      test_count: Number(r.test_count ?? 0),
      success_count: Number(r.success_count ?? 0),
      quality_score: r.quality_score != null ? Number(r.quality_score) : null,
      latency_ms: r.latency_ms != null ? Number(r.latency_ms) : null,
    };
  }

  const now = () => new Date().toISOString();

  return {
    async listTier(tier: 1 | 2 | 3, countryFilter: string | "ALL"): Promise<FreeProxyRow[]> {
      const query =
        countryFilter === "ALL"
          ? "SELECT * FROM free_proxies WHERE tier = ? AND in_pool = 0"
          : "SELECT * FROM free_proxies WHERE tier = ? AND in_pool = 0 AND UPPER(country_code) = ?";
      const params = countryFilter === "ALL" ? [tier] : [tier, countryFilter];
      const rows = db.prepare(query).all(...params);
      return rows.map(rowToFreeProxyRow);
    },

    async listGlobalPool(): Promise<GlobalPoolRow[]> {
      const rows = db
        .prepare(
          `SELECT pr.id AS registryId, pr.type, pr.host, pr.port FROM proxy_registry pr
           JOIN proxy_assignments pa ON pa.proxy_id = pr.id
           WHERE pa.scope = 'global' AND pa.scope_id LIKE '__global__%'
             AND pr.source = ?`
        )
        .all(namePrefix) as Record<string, unknown>[];
      return rows.map((r) => ({
        registryId: String(r.registryId ?? ""),
        type: String(r.type ?? "http"),
        host: String(r.host ?? ""),
        port: Number(r.port) || 0,
      }));
    },

    async countGlobalPool(): Promise<number> {
      const row = db
        .prepare(
          `SELECT COUNT(*) as n FROM proxy_registry pr
           JOIN proxy_assignments pa ON pa.proxy_id = pr.id
           WHERE pa.scope = 'global' AND pa.scope_id LIKE '__global__%'
             AND pr.source = ?`
        )
        .all(namePrefix) as Record<string, unknown>[];
      return Number(row[0]?.n ?? 0);
    },

    async listPromotionCandidates(
      countryFilter: string | "ALL",
      minTests: number,
      minQuality: number,
      limit: number
    ): Promise<PromotionCandidate[]> {
      const query =
        countryFilter === "ALL"
          ? `SELECT id, host, port, type, quality_score, latency_ms
             FROM free_proxies
             WHERE tier = 2 AND in_pool = 0
               AND test_count >= ? AND success_count = test_count AND quality_score >= ?
             ORDER BY quality_score DESC,
               CASE WHEN latency_ms IS NULL THEN 1 ELSE 0 END, latency_ms ASC
             LIMIT ?`
          : `SELECT id, host, port, type, quality_score, latency_ms
             FROM free_proxies
             WHERE tier = 2 AND in_pool = 0 AND UPPER(country_code) = ?
               AND test_count >= ? AND success_count = test_count AND quality_score >= ?
             ORDER BY quality_score DESC,
               CASE WHEN latency_ms IS NULL THEN 1 ELSE 0 END, latency_ms ASC
             LIMIT ?`;

      const params =
        countryFilter === "ALL"
          ? [minTests, minQuality, limit]
          : [countryFilter, minTests, minQuality, limit];

      const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
      return rows.map((r) => ({
        id: String(r.id ?? ""),
        type: String(r.type ?? "http"),
        host: String(r.host ?? ""),
        port: Number(r.port) || 0,
        quality_score: r.quality_score != null ? Number(r.quality_score) : null,
        latency_ms: r.latency_ms != null ? Number(r.latency_ms) : null,
      }));
    },

    async recordTestResult(
      id: string,
      ok: boolean,
      latencyMs: number | null,
      quality: number
    ): Promise<void> {
      db.prepare(
        `UPDATE free_proxies
         SET test_count = test_count + 1,
             success_count = success_count + (CASE WHEN ? = 1 THEN 1 ELSE 0 END),
             consecutive_successes = CASE WHEN ? = 1 THEN consecutive_successes + 1 ELSE 0 END,
             consecutive_failures = CASE WHEN ? = 1 THEN 0 ELSE consecutive_failures + 1 END,
             latency_ms = ?, quality_score = ?, last_validated = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        ok ? 1 : 0,
        ok ? 1 : 0,
        ok ? 1 : 0,
        latencyMs,
        quality,
        now(),
        now(),
        id
      );
    },

    async setTier(id: string, tier: 1 | 2 | 3): Promise<void> {
      db.prepare("UPDATE free_proxies SET tier = ?, updated_at = ? WHERE id = ?").run(
        tier,
        now(),
        id
      );
    },

    async resetCounters(id: string): Promise<void> {
      db.prepare(
        "UPDATE free_proxies SET consecutive_successes = 0, consecutive_failures = 0, updated_at = ? WHERE id = ?"
      ).run(now(), id);
    },

    async delete(id: string): Promise<void> {
      db.prepare("DELETE FROM free_proxies WHERE id = ?").run(id);
    },

    async demoteFromGlobalPool(registryId: string, host: string): Promise<void> {
      const freeProxy = db
        .prepare("SELECT id FROM free_proxies WHERE pool_proxy_id = ?")
        .get(registryId) as { id?: string } | undefined;

      db.prepare("DELETE FROM proxy_assignments WHERE proxy_id = ?").run(registryId);
      db.prepare("DELETE FROM proxy_registry WHERE id = ?").run(registryId);

      if (freeProxy?.id) {
        db.prepare(
          "UPDATE free_proxies SET tier = 1, in_pool = 0, pool_proxy_id = NULL, consecutive_successes = 0, consecutive_failures = 0, updated_at = ? WHERE id = ?"
        ).run(now(), freeProxy.id);
        log.info({ host }, "Demoted Tier 3 proxy to Tier 1");
      } else {
        log.info({ host, registryId }, "Removed Tier 3 proxy (no free_proxies record to demote)");
      }
    },

    async promoteToGlobalCandidate(
      candidate: PromotionCandidate,
      country: string,
      poolSize: number
    ): Promise<void> {
      const nowStr = now();
      const newId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      db.prepare(
        `INSERT INTO proxy_registry
         (id, name, type, host, port, username, password, region, notes, status, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, '', '', ?, ?, 'active', ?, ?, ?)`
      ).run(
        newId,
        `${namePrefix}-${candidate.host}`,
        candidate.type,
        candidate.host,
        candidate.port,
        country,
        `Auto-selected ${country} proxy`,
        namePrefix,
        nowStr,
        nowStr
      );

      const existingPool = db
        .prepare(
          `SELECT pa.scope_id FROM proxy_assignments pa
           JOIN proxy_registry pr ON pr.id = pa.proxy_id
           WHERE pa.scope = 'global' AND pa.scope_id LIKE '__global__%'
           ORDER BY CAST(SUBSTR(pa.scope_id, 11) AS INTEGER) ASC`
        )
        .all() as Array<{ scope_id: string }>;

      const usedSlots = new Set<number>();
      for (const entry of existingPool) {
        const slotNum = parseInt(entry.scope_id.replace("__global__", ""), 10);
        if (!isNaN(slotNum)) usedSlots.add(slotNum);
      }

      let targetSlot = -1;
      for (let i = 0; i < poolSize; i++) {
        if (!usedSlots.has(i)) {
          targetSlot = i;
          break;
        }
      }

      if (targetSlot === -1) {
        const worst = db
          .prepare(
            `SELECT pa.scope_id, pr.id FROM proxy_assignments pa
             JOIN proxy_registry pr ON pr.id = pa.proxy_id
             WHERE pa.scope = 'global' AND pa.scope_id LIKE '__global__%'
             ORDER BY pr.quality_score ASC, pr.updated_at ASC
             LIMIT 1`
          )
          .get() as { scope_id: string; id: string } | undefined;

        if (worst) {
          const worstFreeProxy = db
            .prepare("SELECT id FROM free_proxies WHERE pool_proxy_id = ?")
            .get(worst.id) as { id?: string } | undefined;
          if (worstFreeProxy?.id) {
            db.prepare(
              "UPDATE free_proxies SET tier = 2, in_pool = 0, pool_proxy_id = NULL, consecutive_successes = 0, consecutive_failures = 0, updated_at = ? WHERE id = ?"
            ).run(nowStr, worstFreeProxy.id);
          }
          db.prepare("DELETE FROM proxy_assignments WHERE proxy_id = ?").run(worst.id);
          db.prepare("DELETE FROM proxy_registry WHERE id = ?").run(worst.id);
          targetSlot = parseInt(worst.scope_id.replace("__global__", ""), 10) || 0;
        }
      }

      if (targetSlot >= 0) {
        db.prepare(
          `INSERT INTO proxy_assignments (scope, scope_id, proxy_id, created_at, updated_at)
           VALUES ('global', ?, ?, ?, ?)`
        ).run(`__global__${targetSlot}`, newId, nowStr, nowStr);
      }

      db.prepare(
        "UPDATE free_proxies SET tier = 3, in_pool = 1, pool_proxy_id = ?, updated_at = ? WHERE id = ?"
      ).run(newId, nowStr, candidate.id);
    },

    async deleteNonMatchingCountry(country: string): Promise<number> {
      const result = db
        .prepare(
          "DELETE FROM free_proxies WHERE country_code IS NOT NULL AND UPPER(country_code) != ? AND in_pool = 0"
        )
        .run(country);
      return result.changes;
    },
  };
}
