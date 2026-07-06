#!/usr/bin/env node
/**
 * wipe-all-api-keys.mjs — DESTRUCTIVE: delete EVERY API key in both stores.
 *
 * This wipes:
 *   • every key in OmniRoute's api_keys table (the real credentials)
 *   • every mapping in the portal's user_api_keys table
 *
 * After this runs, NO user can authenticate to the API until they create a
 * new key. Intended for a clean reset after a key-system overhaul.
 *
 * USAGE
 * ─────
 *   node scripts/wipe-all-api-keys.mjs            # dry-run (report counts only)
 *   node scripts/wipe-all-api-keys.mjs --yes      # actually delete everything
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

const ASSUME_YES = process.argv.includes('--yes');

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

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exitCode = 1;
    return;
  }

  console.log(`OmniRoute URL: ${OMNIROUTE_URL}`);
  console.log(`Mode: ${ASSUME_YES ? 'WIPE (will delete EVERYTHING)' : 'DRY-RUN (report only)'}`);
  console.log('');

  await login();

  const [omniKeys, portalCount] = await Promise.all([
    listOmniKeys(),
    prisma.userApiKey.count(),
  ]);

  console.log(`Portal mappings to delete: ${portalCount}`);
  console.log(`OmniRoute keys to delete:   ${omniKeys.length}`);
  console.log('');

  if (!ASSUME_YES) {
    console.log('Dry-run: nothing deleted. Re-run with --yes to wipe everything.');
    return;
  }

  // 1. Delete every OmniRoute key (the real credentials).
  let omniDeleted = 0;
  let omniFailed = 0;
  for (const k of omniKeys) {
    try {
      await deleteOmniKey(k.id);
      omniDeleted++;
    } catch (err) {
      omniFailed++;
      console.error(`  FAILED to delete OmniRoute key ${k.id}: ${err.message}`);
    }
  }
  console.log(`OmniRoute: deleted ${omniDeleted}/${omniKeys.length} key(s)${omniFailed ? `, ${omniFailed} failed` : ''}.`);

  // 2. Delete every portal mapping.
  const portalDeleted = await prisma.userApiKey.deleteMany({});
  console.log(`Portal: deleted ${portalDeleted.count} mapping(s).`);

  console.log('');
  console.log('── Wipe complete ──');
  console.log('All users must create new API keys from the dashboard.');
}

main()
  .catch((err) => {
    console.error('Wipe failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
