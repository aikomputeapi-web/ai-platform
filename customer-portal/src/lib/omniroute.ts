/**
 * OmniRoute Internal API Client
 *
 * Calls OmniRoute's admin API to create/manage API keys and pull usage data.
 * This runs server-side only — the admin credentials never reach the browser.
 *
 * ── Why this module exists ──────────────────────────────────────────────────
 * The Customer Portal (PostgreSQL) and OmniRoute (SQLite) are two SEPARATE
 * databases. The portal stores a *mapping* (user_api_keys.omniroute_key_id)
 * pointing at the real key row inside OmniRoute's api_keys table. They can
 * drift — see docs/API-KEY-SYSTEM-DIAGNOSIS.md — so every call here must be
 * resilient to a stale admin token and surface real errors instead of
 * silently returning `false`.
 */

const OMNIROUTE_URL = process.env.OMNIROUTE_INTERNAL_URL || 'http://127.0.0.1:20128';
const ADMIN_PASSWORD = process.env.OMNIROUTE_ADMIN_PASSWORD || 'admin123';

// OmniRoute JWTs are signed for 30d (src/app/api/auth/login/route.ts). We cache
// the extracted auth_token cookie for a shorter window so a password rotation
// on the OmniRoute side is picked up without a portal restart, but we don't
// hammer the login endpoint on every request.
const TOKEN_CACHE_MS = 60 * 60 * 1000; // 1h

let _adminToken: string | null = null;
let _tokenExpiry = 0;
// Single-flight guard: when many requests need a token at once (cold start,
// hourly expiry, or a burst of 401 retries), only ONE login request goes to
// OmniRoute and the rest await it. OmniRoute's login endpoint has brute-force
// lockout, so a login stampede can 429 us and take down every key/usage call.
let _loginInFlight: Promise<string> | null = null;

/**
 * Log in to OmniRoute and cache the auth_token cookie value.
 * Throws on failure so callers can distinguish "OmniRoute is down / password
 * changed" from "the actual operation failed".
 */
async function fetchAdminToken(): Promise<string> {
  const res = await fetch(`${OMNIROUTE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });

  if (!res.ok) {
    // 403 needsSetup / 429 brute-force lockout / 500 misconfigured — all surface
    // as a real error so the portal route can return a meaningful message
    // instead of a generic 500.
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) detail += `: ${body.error}`;
    } catch {
      /* non-JSON body */
    }
    throw new Error(`OmniRoute login failed (${detail})`);
  }

  // Extract auth_token cookie from Set-Cookie header
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/auth_token=([^;]+)/);
  if (!match) {
    throw new Error('OmniRoute login succeeded but no auth_token cookie was returned');
  }

  _adminToken = match[1];
  _tokenExpiry = Date.now() + TOKEN_CACHE_MS;
  return _adminToken;
}

/**
 * Return a cached admin token, refreshing it if it's missing or stale.
 */
async function getAdminToken(): Promise<string> {
  if (_adminToken && Date.now() < _tokenExpiry) {
    return _adminToken;
  }
  if (!_loginInFlight) {
    _loginInFlight = fetchAdminToken().finally(() => {
      _loginInFlight = null;
    });
  }
  return _loginInFlight;
}

/**
 * Force a fresh login on the next call. Used after a 401 to drop a token that
 * OmniRoute has rejected (e.g. password rotated, JWT invalidated).
 */
function invalidateAdminToken(): void {
  _adminToken = null;
  _tokenExpiry = 0;
}

/**
 * Low-level fetch against OmniRoute's admin API with the auth cookie attached.
 *
 * Retries ONCE on 401 by re-logging in — handles the case where the cached
 * token was rejected (password rotation, container restart with a new
 * JWT_SECRET, etc.) without making every caller re-implement the retry.
 *
 * @param retryOn401 internal flag — set false to avoid infinite recursion
 */
export async function omnirouteFetch(
  path: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<Response> {
  const token = await getAdminToken();
  const res = await fetch(`${OMNIROUTE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Cookie: `auth_token=${token}`,
      ...options.headers,
    },
  });

  // A 401 here means OmniRoute rejected our cached token. Re-login once and
  // retry the original request so transient auth failures don't bubble up as
  // user-facing 500s.
  if (res.status === 401 && retryOn401) {
    invalidateAdminToken();
    return omnirouteFetch(path, options, false);
  }

  return res;
}

// ─── API Key Management ─────────────────────────────────────────────────────

export interface OmniRouteKey {
  id: string;
  key: string;
  name: string;
  machineId?: string;
}

/**
 * Create a key in OmniRoute. Throws on non-2xx so the caller can decide whether
 * to roll back (the portal route deletes the OmniRoute key if the local
 * mapping write fails — see app/api/keys/route.ts).
 */
export async function createOmniRouteKey(
  name: string,
  scopes: string[] = []
): Promise<OmniRouteKey> {
  // OmniRoute requires a machineId — we generate a unique one per customer key
  // so the key format (sk-{machineId}-{keyId}-{crc8}) is unique even though
  // every portal-created key originates from the same server.
  const machineId = `portal-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const res = await omnirouteFetch('/api/keys', {
    method: 'POST',
    body: JSON.stringify({ name, machineId, scopes }),
  });

  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to create API key in OmniRoute: ${error}`);
  }

  return res.json();
}

/**
 * Delete a key in OmniRoute. Returns true on success, false if the key was
 * already gone (404) — both are "the key no longer exists in OmniRoute" and
 * are safe for the portal to treat as deleted. Throws on other errors so the
 * caller can decide whether to keep the mapping.
 */
export async function deleteOmniRouteKey(keyId: string): Promise<boolean> {
  const res = await omnirouteFetch(`/api/keys/${keyId}`, {
    method: 'DELETE',
  });

  if (res.ok) return true;
  if (res.status === 404) return false; // already deleted — idempotent
  const error = await res.text().catch(() => res.statusText);
  throw new Error(`Failed to delete API key in OmniRoute: ${error}`);
}

/**
 * Map a plan row to the OmniRoute key-limit payload. A limit of 0 on the plan
 * means "unlimited", which OmniRoute expects as null; '*' allowedModels means
 * "all models", which OmniRoute expects as an empty array. Shared by key
 * creation and the Stripe webhook's upgrade/downgrade paths so the mappings
 * can't drift apart.
 */
export function planKeyLimits(plan: {
  requestsPerDay: number;
  requestsPerMinute: number;
  requestsPerMonth?: number;
  allowedModels: string;
}) {
  const monthly = plan.requestsPerMonth ?? 0;
  return {
    maxRequestsPerDay: plan.requestsPerDay > 0 ? plan.requestsPerDay : null,
    maxRequestsPerMinute: plan.requestsPerMinute > 0 ? plan.requestsPerMinute : null,
    maxRequestsPerMonth: monthly > 0 ? monthly : null,
    allowedModels: plan.allowedModels === '*' ? [] : (JSON.parse(plan.allowedModels) as string[]),
  };
}

/**
 * Update a key's limits/permissions in OmniRoute. Throws on non-2xx so the
 * caller knows the limits weren't applied (the key still works, just without
 * the plan's rate caps — better to surface this than silently swallow it).
 */
export async function updateKeyLimits(
  keyId: string,
  limits: {
    maxRequestsPerDay?: number | null;
    maxRequestsPerMinute?: number | null;
    maxRequestsPerMonth?: number | null;
    allowedModels?: string[];
    isActive?: boolean;
    scopes?: string[] | null;
  }
): Promise<boolean> {
  const res = await omnirouteFetch(`/api/keys/${keyId}`, {
    method: 'PATCH',
    body: JSON.stringify(limits),
  });

  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to update key limits in OmniRoute: ${error}`);
  }
  return true;
}

/**
 * List ALL keys currently in OmniRoute. Used by the reconciliation path to
 * detect drift between the portal's user_api_keys table and OmniRoute's
 * api_keys table (keys created directly in the OmniRoute dashboard, or keys
 * left behind after a portal mapping was deleted).
 *
 * Returns the masked key list OmniRoute exposes (the raw key is NOT included
 * — OmniRoute masks it in GET /api/keys). The id is what we need for
 * reconciliation.
 */
export async function listOmniRouteKeys(): Promise<
  Array<{ id: string; name: string; isActive: boolean; createdAt?: string }>
> {
  const res = await omnirouteFetch('/api/keys');
  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to list OmniRoute keys: ${error}`);
  }
  const data = await res.json();
  // OmniRoute returns { keys: [...], total, allowKeyReveal }
  return (data.keys || []).map((k: Record<string, unknown>) => ({
    id: String(k.id ?? ''),
    name: String(k.name ?? ''),
    isActive: Boolean(k.isActive ?? true),
    createdAt: typeof k.createdAt === 'string' ? k.createdAt : undefined,
  }));
}

// ─── Usage Analytics ─────────────────────────────────────────────────────────

export async function getUsageAnalytics(range = '30d', apiKeyIds?: string[]): Promise<any> {
  const params = new URLSearchParams({ range });
  if (apiKeyIds && apiKeyIds.length > 0) {
    params.set('apiKeyIds', apiKeyIds.join(','));
  }
  const res = await omnirouteFetch(`/api/usage/analytics?${params.toString()}`);
  if (!res.ok) return null;
  return res.json();
}

// ─── Models ──────────────────────────────────────────────────────────────────

export async function getAvailableModels(): Promise<any[]> {
  const res = await omnirouteFetch('/api/v1/models');
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}
