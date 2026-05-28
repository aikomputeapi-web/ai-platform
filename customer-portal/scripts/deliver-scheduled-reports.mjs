import fs from 'fs';

const PORTAL_URL = (process.env.PORTAL_INTERNAL_URL || 'http://customer-portal:3000').replace(/\/$/, '');
const SECRET = process.env.REPORT_DELIVERY_SECRET || process.env.ADMIN_API_SECRET || process.env.OMNIROUTE_INITIAL_PASSWORD || 'admin';
const LIMIT = Math.min(Math.max(Number(process.env.REPORT_DELIVERY_LIMIT || 20) || 20, 1), 100);
const INTERVAL_SECONDS = Math.max(Number(process.env.REPORT_DELIVERY_INTERVAL_SECONDS || 300) || 300, 30);
const ONCE = process.argv.includes('--once') || process.env.REPORT_DELIVERY_ONCE === 'true';

let running = false;

async function deliverOnce() {
  const res = await fetch(`${PORTAL_URL}/api/admin/scheduled-reports/deliver?limit=${LIMIT}&source=worker`, {
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
