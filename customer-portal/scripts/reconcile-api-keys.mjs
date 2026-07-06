#!/usr/bin/env node
/**
 * reconcile-api-keys.mjs — one-shot reconciliation between the Customer Portal
 * (PostgreSQL) and OmniRoute (SQLite) API key stores.
 *
 * WHY THIS EXISTS
 * ──────────────
 * The portal stores a *mapping* (user_api_keys.omniroute_key_id) pointing at
 * the real key row inside OmniRoute's api_keys table. They are two separate
 * databases with no transaction spanning them, so they drift over time:
 *
 *   • Portal mapping exists, OmniRoute key is gone → user sees a "working" key
 *     that 401s on every request (the reported "api keys not working").
 *   • OmniRoute key exists, no portal mapping → an unowned, usable credential
 *     (security hole; also inflates OmniRoute's key count vs the portal's).
 *
 * Both are exactly the "mismatched number of api keys between the customer
 * portal and omniroute" symptom.
 *
 * WHAT IT DOES
 * ────────────
 *   1. Lists every key in OmniRoute (GET /api/keys, admin-authed).
 *   2. Lists every mapping in the portal (user_api_keys).
 *   3. For portal mappings whose OmniRoute key is missing: marks the mapping
 *      isActive=false (so the UI shows "Revoked" and the user recreates it).
 *   4. For OmniRoute keys with no portal mapping: by default REPORTS them
 *      (dry-run). With --prune it deletes them from OmniRoute so the counts
 *      match and no unowned credential lingers.
 *
 * USAGE
 * ─────
 *   node scripts/reconcile-api-keys.mjs            # dry-run (report only)
 *   node scripts/reconcile-api-keys.mjs --prune    # delete orphaned OmniRoute keys
 *   node scripts/reconcile-api-keys.mjs --prune --yes   # skip the confirm prompt
 *
 * ENV
 * ────
 *   DATABASE_URL              — portal PostgreSQL (required)
 *   OMNIROUTE_INTERNAL_URL    — OmniRoute base URL (default http://127.0.0.1:20128)
 *   OMNIROUTE_ADMIN_PASSWORD  — OmniRoute admin password (required)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OMNIROUTE_URL = process.env.OMNIROUTE_INTERNAL_URL || 'http://127.0.0.1:20128';
const ADMIN_PASSWORD = process.env.OMNIROUTE_ADMIN_PASSWORD || 'admin123';

const args = process.argv.slice(2);
const PRUNE = args.includes('--prune');
const ASSUME_YES = args.includes('--yes');

// ─── OmniRoute admin auth (mirrors src/lib/omniroute.ts) ─────────────────────

let adminToken = null;

async function login() {
  const res = await fetch(`${OMNIROUTE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OmniRoute login failed (${res.status}): ${body}`);
  }
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/auth_token=([^;]+)/);
  if (!match) throw new Error('OmniRoute login returned no auth_token cookie');
  adminToken = match[1];
}

async function omniFetch(path, options = {}) {
  const res = await fetch(`${OMNIROUTE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Cookie: `auth_token=${adminToken}`,
      ...options.headers,
    },
  });
  return res;
}

async function listOmniKeys() {
  const res = await omniFetch('/api/keys');
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`GET /api/keys failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.keys || [];
}

async function deleteOmniKey(id) {
  const res = await omniFetch(`/api/keys/${id}`, { method: 'DELETE' });
  if (res.ok || res.status === 404) return true;
  const body = await res.text().catch(() => res.statusText);
  throw new Error(`DELETE /api/keys/${id} failed (${res.status}): ${body}`);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exitCode = 1;
    return;
  }
  if (!process.env.OMNIROUTE_ADMIN_PASSWORD) {
    console.error('WARNING: OMNIROUTE_ADMIN_PASSWORD is not set; using default "admin123".');
  }

  console.log(`OmniRoute URL: ${OMNIROUTE_URL}`);
  console.log(`Mode: ${PRUNE ? 'PRUNE (will delete orphaned OmniRoute keys)' : 'DRY-RUN (report only)'}`);
  console.log('');

  await login();

  const [omniKeys, portalKeys] = await Promise.all([
    listOmniKeys(),
    prisma.userApiKey.findMany({ include: { user: { select: { email: true } } } }),
  ]);

  const omniKeyIds = new Set(omniKeys.map((k) => k.id));
  const portalKeyIds = new Set(portalKeys.map((k) => k.omnirouteKeyId));

  console.log(`Portal mappings:  ${portalKeys.length}`);
  console.log(`OmniRoute keys:   ${omniKeys.length}`);
  console.log('');

  // 1. Portal mappings whose OmniRoute key is missing → mark inactive.
  const orphanedPortalMappings = portalKeys.filter(
    (k) => k.isActive && !omniKeyIds.has(k.omnirouteKeyId)
  );
  console.log(
    `Portal mappings pointing at a MISSING OmniRoute key: ${orphanedPortalMappings.length}`
  );
  if (orphanedPortalMappings.length > 0) {
    for (const k of orphanedPortalMappings) {
      console.log(
        `  • ${k.name} (portal id ${k.id}, omni id ${k.omnirouteKeyId}) — user ${k.user?.email || '?'}`
      );
    }
    if (PRUNE) {
      const result = await prisma.userApiKey.updateMany({
        where: { id: { in: orphanedPortalMappings.map((k) => k.id) } },
        data: { isActive: false },
      });
      console.log(`  → marked ${result.count} mapping(s) inactive.`);
    } else {
      console.log('  (dry-run: not modifying. Re-run with --prune to mark inactive.)');
    }
  }
  console.log('');

  // 2. OmniRoute keys with no portal mapping → orphans (unowned credentials).
  const orphanedOmniKeys = omniKeys.filter((k) => !portalKeyIds.has(k.id));
  console.log(`OmniRoute keys with NO portal mapping (unowned): ${orphanedOmniKeys.length}`);
  if (orphanedOmniKeys.length > 0) {
    for (const k of orphanedOmniKeys) {
      console.log(`  • ${k.name} (omni id ${k.id}, active=${k.isActive})`);
    }
    if (PRUNE) {
      if (!ASSUME_YES) {
        console.log('');
        const confirmed = await confirm(
          `Delete ${orphanedOmniKeys.length} orphaned OmniRoute key(s)? This cannot be undone.`
        );
        if (!confirmed) {
          console.log('  → skipped (user declined).');
        } else {
          let deleted = 0;
          for (const k of orphanedOmniKeys) {
            try {
              await deleteOmniKey(k.id);
              deleted++;
              console.log(`  → deleted ${k.id}`);
            } catch (err) {
              console.error(`  → FAILED to delete ${k.id}: ${err.message}`);
            }
          }
          console.log(`  → deleted ${deleted}/${orphanedOmniKeys.length} orphaned key(s).`);
        }
      } else {
        let deleted = 0;
        for (const k of orphanedOmniKeys) {
          try {
            await deleteOmniKey(k.id);
            deleted++;
          } catch (err) {
            console.error(`  → FAILED to delete ${k.id}: ${err.message}`);
          }
        }
        console.log(`  → deleted ${deleted}/${orphanedOmniKeys.length} orphaned key(s).`);
      }
    } else {
      console.log('  (dry-run: not deleting. Re-run with --prune to delete.)');
    }
  }
  console.log('');

  // 3. Summary
  const stillActivePortal = portalKeys.filter((k) => k.isActive).length;
  const stillActiveOmni = omniKeys.filter((k) => k.isActive).length;
  console.log('── Summary ──');
  console.log(`Active portal mappings: ${stillActivePortal}`);
  console.log(`Active OmniRoute keys:   ${stillActiveOmni}`);
  if (PRUNE) {
    console.log('Reconciliation complete. Counts should now match (or be closer).');
  } else {
    console.log('Dry-run complete. Re-run with --prune to apply changes.');
  }
}

function confirm(message) {
  return new Promise((resolve) => {
    process.stdout.write(`${message} [y/N] `);
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdin.on('data', (chunk) => {
      data += chunk;
      if (data.includes('\n')) {
        process.stdin.pause();
        resolve(data.trim().toLowerCase().startsWith('y'));
      }
    });
  });
}

main()
  .catch((err) => {
    console.error('Reconciliation failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
