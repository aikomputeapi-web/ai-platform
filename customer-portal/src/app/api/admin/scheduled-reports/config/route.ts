import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { adminForbidden, recordAdminAction, verifyAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const DELIVERY_SETTING_KEY = 'scheduled_reports_delivery';

async function readConfig() {
  const rows = await prisma.$queryRaw<Array<{ value: unknown }>>(Prisma.sql`
    SELECT value
    FROM admin_settings
    WHERE key = ${DELIVERY_SETTING_KEY}
    LIMIT 1
  `);

  const value = rows[0]?.value;
  const data = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

  return {
    enabled: data.enabled !== false,
    pausedAt: typeof data.pausedAt === 'string' ? data.pausedAt : null,
    pausedBy: typeof data.pausedBy === 'string' ? data.pausedBy : null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
  };
}

async function writeConfig(nextConfig: { enabled: boolean; pausedAt: string | null; pausedBy: string | null }) {
  const payload = {
    enabled: nextConfig.enabled,
    pausedAt: nextConfig.pausedAt,
    pausedBy: nextConfig.pausedBy,
    updatedAt: new Date().toISOString(),
  };

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO admin_settings (key, value, created_at, updated_at)
    VALUES (${DELIVERY_SETTING_KEY}, ${JSON.stringify(payload)}::jsonb, NOW(), NOW())
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `);

  return payload;
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const config = await readConfig();
    return NextResponse.json({ config });
  } catch (error) {
    console.error('Scheduled report config fetch error:', error);
    return NextResponse.json({ error: 'Failed to load scheduled report config' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const body = await req.json();
    const enabled = body?.enabled !== false;
    const actor = typeof body?.actor === 'string' && body.actor.trim() ? body.actor.trim() : 'admin';

    const config = await writeConfig({
      enabled,
      pausedAt: enabled ? null : new Date().toISOString(),
      pausedBy: enabled ? null : actor,
    });

    await recordAdminAction({
      action: enabled ? 'report.delivery_resumed' : 'report.delivery_paused',
      req,
      metadata: { enabled, actor },
    });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Scheduled report config update error:', error);
    return NextResponse.json({ error: 'Failed to update scheduled report config' }, { status: 500 });
  }
}
