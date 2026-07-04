import type { DbAdapter, Logger } from "../adapters.js";
import type { PromotionCandidate } from "../types.js";

export async function promoteProxyToGlobal(
  db: DbAdapter,
  log: Logger,
  candidate: PromotionCandidate,
  country: string,
  poolSize: number,
  namePrefix: string
): Promise<void> {
  const now = new Date().toISOString();
  const proxyUrl = `${candidate.type}://${candidate.host}:${candidate.port}`;

  const pool = await db.listGlobalPool();
  const existing = pool.find((p) => p.host === candidate.host && p.port === candidate.port);

  if (existing) {
    if (typeof (db as any).__directUpdate === "function") {
      await (db as any).__directUpdate(existing.registryId, now, candidate.id);
    }
    return;
  }

  await db.promoteToGlobalCandidate(candidate, country, poolSize, namePrefix);

  log.info(
    {
      host: candidate.host,
      port: candidate.port,
      type: candidate.type,
      url: proxyUrl,
    },
    `Promoted ${country} proxy to global pool (Tier 3)`
  );
}

export async function demoteTier3ToTier2(
  db: DbAdapter,
  log: Logger,
  registryId: string,
  host: string
): Promise<void> {
  await db.demoteFromGlobalPool(registryId, host);
  log.info({ host }, "Demoted Tier 3 proxy to Tier 2");
}
