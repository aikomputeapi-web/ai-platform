import fs from 'fs';

const DEFAULT_PORTAL_URL = (process.env.PORTAL_INTERNAL_URL || 'http://customer-portal:3000').replace(/\/$/, '');
const SLOT_FILE = process.env.ACTIVE_SLOT_FILE || '/app/deploy-state/active-slot';

// Resolve the LIVE portal each cycle via the blue-green slot file (see
// reconcile-api-keys-worker.mjs for the full rationale) — reports must pull
// usage from the slot actually serving traffic, not a stale standby.
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
const SECRET = process.env.REPORT_DELIVERY_SECRET || process.env.ADMIN_API_SECRET || process.env.OMNIROUTE_INITIAL_PASSWORD || 'admin';
const LIMIT = Math.min(Math.max(Number(process.env.REPORT_DELIVERY_LIMIT || 20) || 20, 1), 100);
const INTERVAL_SECONDS = Math.max(Number(process.env.REPORT_DELIVERY_INTERVAL_SECONDS || 300) || 300, 30);
const ONCE = process.argv.includes('--once') || process.env.REPORT_DELIVERY_ONCE === 'true';

let running = false;

async function deliverOnce() {
  const res = await fetch(`${portalUrl()}/api/admin/scheduled-reports/deliver?limit=${LIMIT}&source=worker`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SECRET}`,
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
    throw new Error(`Delivery request failed (${res.status}): ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
  }

  if (typeof payload === 'object' && payload && payload.paused) {
    console.log('[scheduled-reports] delivery paused by admin setting');
    return;
  }

  console.log(`[scheduled-reports] delivered: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
}

async function runLoop() {
  if (running) return;
  running = true;
  try {
    await deliverOnce();
    try {
      fs.writeFileSync('/tmp/healthy', Date.now().toString());
    } catch (e) {
      console.warn('[scheduled-reports] failed to write health file:', e.message);
    }
  } catch (error) {
    console.error('[scheduled-reports] delivery cycle failed:', error);
  } finally {
    running = false;
    if (!ONCE) {
      setTimeout(runLoop, INTERVAL_SECONDS * 1000);
    }
  }
}

if (ONCE) {
  await deliverOnce();
} else {
  console.log(`[scheduled-reports] worker started, polling every ${INTERVAL_SECONDS}s`);
  await runLoop();
  await new Promise(() => {});
}
