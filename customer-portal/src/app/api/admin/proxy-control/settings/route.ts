import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { adminForbidden, recordAdminAction, verifyAdminAccess } from '@/lib/admin';
import { patchProxyControlSettings, type ProxySettingsPatch } from '@/lib/proxy-control-bridge';
import { settingsToJobSettingsMs } from '@/lib/proxy-control';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/proxy-control/settings
 *
 * Persists proxy pool `JobSettings`-aligned values to the OmniRoute
 * proxy-control service. The request body is a partial `ProxySettings` map
 * plus an optional `actor` name. Numeric minute fields are validated and
 * forwarded; the OmniRoute side is expected to coerce them to milliseconds
 * (`JobSettings.checkIntervalMs`). Response mirrors the GET snapshot on
 * success so the UI can refresh in a single round-trip.
 */

// Public expose is intentional: the wire contract declares minute fields, but
// the JobSettings-aligned package expects milliseconds. Callers needing the
// conversion (e.g. a future internal caller) can import this without re-reading
// the proxy-control module.
export { settingsToJobSettingsMs };

const KNOWN_BOOL = ['enabled', 'autoElevate', 'autoRemoveDead', 'autoDistribute'] as const;
const KNOWN_NUMBER = [
  'checkIntervalMinutes',
  'syncIntervalMinutes',
  'minQuality',
  'minSuccessRate',
  'minTests',
  'poolSize',
  'tier1PromoteThreshold',
  'tier2DemoteThreshold',
  'liveFailThreshold',
] as const;

function coercePatch(body: unknown): {
  patch: ProxySettingsPatch;
  fieldSummary: Record<string, unknown>;
  actor: string;
} | { error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'Invalid JSON body' };
  }
  const raw = body as Record<string, unknown>;
  const actor =
    typeof raw.actor === 'string' && raw.actor.trim() ? raw.actor.trim() : 'admin';

  const patch: ProxySettingsPatch = { actor };
  const summary: Record<string, unknown> = {};

  for (const key of KNOWN_BOOL) {
    if (typeof raw[key] === 'boolean') {
      patch[key] = raw[key];
      summary[key] = raw[key];
    }
  }
  for (const key of KNOWN_NUMBER) {
    if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) {
      const value = Math.max(0, Math.round(raw[key]));
      patch[key] = value;
      summary[key] = value;
    }
  }
  if (typeof raw.countryFilter === 'string' && raw.countryFilter.trim()) {
    const upper = raw.countryFilter.trim().toUpperCase().slice(0, 8);
    patch.countryFilter = upper;
    summary.countryFilter = upper;
  }
  if (typeof raw.providers === 'object' && raw.providers !== null && !Array.isArray(raw.providers)) {
    const providerMap = raw.providers as Record<string, unknown>;
    const providers: Record<string, boolean> = {};
    for (const [provider, value] of Object.entries(providerMap)) {
      if (typeof value === 'boolean') {
        providers[provider] = value;
      }
    }
    if (Object.keys(providers).length > 0) {
      patch.providers = providers;
      summary.providers = Object.keys(providers);
    }
  }
  return { patch, fieldSummary: summary, actor };
}

export async function PATCH(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const coerced = coercePatch(body);
  if ('error' in coerced) {
    return NextResponse.json({ error: coerced.error }, { status: 400 });
  }

  // Skip `actor` itself when deciding whether any operational field changed.
  const operationalKeys = Object.keys(coerced.patch).filter((k) => k !== 'actor');
  if (operationalKeys.length === 0) {
    return NextResponse.json({ error: 'No settings provided' }, { status: 400 });
  }

  const result = await patchProxyControlSettings(coerced.patch);
  if (!result.ok) {
    const status = result.error.status === 0 ? 502 : Math.min(599, result.error.status);
    return NextResponse.json(
      { error: result.error.message, upstreamStatus: result.error.status },
      { status },
    );
  }

  await recordAdminAction({
    action: 'proxy-control.settings.update',
    req,
    metadata: {
      actor: coerced.actor,
      changesSummary: coerced.fieldSummary,
    } as Prisma.InputJsonValue,
  });

  return NextResponse.json(result.snapshot);
}
