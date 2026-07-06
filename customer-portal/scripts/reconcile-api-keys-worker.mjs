#!/usr/bin/env node
/**
 * reconcile-api-keys-worker.mjs — long-running reconciliation worker.
 *
 * Polls the portal's admin reconciliation endpoint on a fixed interval so the
 * Customer Portal (PostgreSQL) and OmniRoute (SQLite) API key stores can't
 * drift for more than a few minutes. This is the durable half of the fix:
 * OmniRoute is the single source of truth that *issues* keys, the portal
 * *mirrors* them, and this worker keeps the mirror in sync automatically —
 * no operator intervention required, no reliance on a user loading their
 * dashboard.
 *
 * WHAT IT DOES EACH CYCLE
 * ───────────────────────
 *   POST /api/admin/keys/reconcile  (Bearer ADMIN_API_SECRET)
 *     • marks portal mappings whose OmniRoute key is missing → inactive
 *     • deletes OmniRoute keys that have no portal mapping (unowned)
 *
 * ENV
 * ────
 *   PORTAL_INTERNAL_URL          — portal base URL (default http://customer-portal:3000)
 *   ADMIN_API_SECRET             — shared secret for admin endpoints (required)
 *   RECONCILE_INTERVAL_SECONDS   — poll interval (default 300 = 5min, min 60)
 *   RECONCILE_ONCE=true          — run a single cycle and exit (for cron-style use)
 *
 * This mirrors the deliver-scheduled-reports.mjs worker pattern so it slots
 * into docker-compose.unified.yml the same way (see report-deliverer service).
 */

import fs from 'fs';

const PORTAL_URL = (process.env.PORTAL_INTERNAL_URL || 'http://customer-portal:3000').replace(/\/$/, '');
const SECRET = process.env.ADMIN_API_SECRET || process.env.OMNIROUTE_INITIAL_PASSWORD || 'admin';
const INTERVAL_SECONDS = Math.max(Number(process.env.RECONCILE_INTERVAL_SECONDS || 300) || 300, 60);
const ONCE = process.argv.includes('--once') || process.env.RECONCILE_ONCE === 'true';

let running = false;

async function reconcileOnce() {
  const res = await fetch(`${PORTAL_URL}/api/admin/keys/reconcile`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SECRET}`,
      'x-worker': 'scheduled-reconciler',
    },
  });

  const raw = await res.text();
  let payload = raw;
  try {
    payload = JSON.parse(raw);
  } catch {
    // keep raw text
  }

  if (!res.ok) {
    throw new Error(`Reconcile request failed (${res.status}): ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
  }

  if (typeof payload === 'object' && payload) {
    const r = payload;
    const drift =
      (r.deadPortalMappings || 0) + (r.orphanedOmniRouteKeys || 0);
    if (drift > 0) {
      console.log(
        `[reconcile] corrected drift: ${r.deadPortalMappingsMarkedInactive || 0} dead mapping(s) marked inactive, ` +
        `${r.orphanedOmniRouteKeysDeleted || 0} orphaned OmniRoute key(s) deleted ` +
        `(portal=${r.portalMappings}, omniroute=${r.omniRouteKeys})`
      );
    } else {
      console.log(
        `[reconcile] in sync (portal=${r.portalMappings}, omniroute=${r.omniRouteKeys})`
      );
    }
  } else {
    console.log(`[reconcile] ${payload}`);
  }
}

async function runLoop() {
  if (running) return;
  running = true;
  try {
    await reconcileOnce();
    try {
      fs.writeFileSync('/tmp/healthy', Date.now().toString());
    } catch (e) {
      console.warn('[reconcile] failed to write health file:', e.message);
    }
  } catch (error) {
    console.error('[reconcile] cycle failed:', error);
  } finally {
    running = false;
    if (!ONCE) {
      setTimeout(runLoop, INTERVAL_SECONDS * 1000);
    }
  }
}

if (ONCE) {
  await reconcileOnce();
} else {
  console.log(`[reconcile] worker started, polling every ${INTERVAL_SECONDS}s`);
  await runLoop();
  await new Promise(() => {});
}
