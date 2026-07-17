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

const DEFAULT_PORTAL_URL = (process.env.PORTAL_INTERNAL_URL || 'http://customer-portal:3000').replace(/\/$/, '');
const SLOT_FILE = process.env.ACTIVE_SLOT_FILE || '/app/deploy-state/active-slot';

/**
 * Resolve the LIVE portal's URL, re-reading the slot file on every cycle.
 *
 * The blue-green switch writes "blue" or "green" to SLOT_FILE (bind-mounted
 * from deploy-state/ on the host) whenever traffic flips. This worker MUST
 * follow it: reconciling through the STANDBY portal compares Postgres against
 * the standby slot's stale SQLite, which marks live keys' mappings dead and
 * ultimately deletes the keys themselves (that is how a customer key was
 * destroyed on 2026-07-17). No slot file → single-instance setup → env default.
 */
function portalUrl() {
  try {
    const slot = fs.readFileSync(SLOT_FILE, 'utf8').trim().toLowerCase();
    if (slot === 'green') return 'http://customer-portal-green:3000';
    if (slot === 'blue') return 'http://customer-portal:3000';
  } catch {
    // no slot file — fall through to the env default
  }
  return DEFAULT_PORTAL_URL;
}
const SECRET = resolveSecret();

// Mirrors getAdminSecret() in src/lib/admin-session.ts: the portal refuses the
// 'admin' default in production, so a worker falling back to it there would
// just 401 forever — fail fast instead.
function resolveSecret() {
  const secret = process.env.ADMIN_API_SECRET || process.env.OMNIROUTE_INITIAL_PASSWORD;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    console.error('[reconcile] fatal: ADMIN_API_SECRET must be set in production');
    process.exit(1);
  }
  console.warn('[reconcile] WARNING: ADMIN_API_SECRET is not set. Using insecure dev default "admin".');
  return 'admin';
}
const INTERVAL_SECONDS = Math.max(Number(process.env.RECONCILE_INTERVAL_SECONDS || 300) || 300, 60);
const ONCE = process.argv.includes('--once') || process.env.RECONCILE_ONCE === 'true';

let running = false;

async function reconcileOnce() {
  const res = await fetch(`${portalUrl()}/api/admin/keys/reconcile`, {
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
