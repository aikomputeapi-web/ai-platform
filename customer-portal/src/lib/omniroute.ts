/**
 * OmniRoute Internal API Client
 * 
 * Calls OmniRoute's admin API to create/manage API keys and pull usage data.
 * This runs server-side only — the admin credentials never reach the browser.
 */

const OMNIROUTE_URL = process.env.OMNIROUTE_INTERNAL_URL || 'http://127.0.0.1:20128';
const ADMIN_PASSWORD = process.env.OMNIROUTE_ADMIN_PASSWORD || 'admin123';

let _adminToken: string | null = null;
let _tokenExpiry = 0;

async function getAdminToken(): Promise<string> {
  if (_adminToken && Date.now() < _tokenExpiry) {
    return _adminToken;
  }

  const res = await fetch(`${OMNIROUTE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });

  if (!res.ok) {
    throw new Error(`OmniRoute login failed: ${res.status}`);
  }

  // Extract auth_token cookie from Set-Cookie header
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/auth_token=([^;]+)/);
  if (!match) {
    throw new Error('No auth_token in OmniRoute response');
  }

  _adminToken = match[1];
  _tokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24h
  return _adminToken;
}

async function omnirouteFetch(path: string, options: RequestInit = {}) {
  const token = await getAdminToken();
  const res = await fetch(`${OMNIROUTE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Cookie: `auth_token=${token}`,
      ...options.headers,
    },
  });
  return res;
}

// ─── API Key Management ─────────────────────────────────────────────────────

export async function createOmniRouteKey(name: string): Promise<{
  id: string;
  key: string;
  name: string;
}> {
  // OmniRoute requires a machineId — we generate a unique one per customer key
  const machineId = `portal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  
  const res = await omnirouteFetch('/api/keys', {
    method: 'POST',
    body: JSON.stringify({ name, machineId }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create API key: ${error}`);
  }

  return res.json();
}

export async function deleteOmniRouteKey(keyId: string): Promise<boolean> {
  const res = await omnirouteFetch(`/api/keys/${keyId}`, {
    method: 'DELETE',
  });
  return res.ok;
}

export async function updateKeyLimits(
  keyId: string,
  limits: {
    maxRequestsPerDay?: number | null;
    maxRequestsPerMinute?: number | null;
    maxRequestsPerMonth?: number | null;
    allowedModels?: string[];
    isActive?: boolean;
  }
): Promise<boolean> {
  const res = await omnirouteFetch(`/api/keys/${keyId}`, {
    method: 'PATCH',
    body: JSON.stringify(limits),
  });
  return res.ok;
}

// ─── Usage Analytics ─────────────────────────────────────────────────────────

export async function getUsageAnalytics(range = '30d'): Promise<any> {
  const res = await omnirouteFetch(`/api/analytics?range=${range}`);
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
