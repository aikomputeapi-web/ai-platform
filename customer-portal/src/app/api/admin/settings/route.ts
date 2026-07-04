import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { adminForbidden, recordAdminAction, verifyAdminAccess } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const SETTINGS = {
  maintenance: 'platform_maintenance',
  support: 'support_contact',
  announcement: 'announcement_banner',
  emailDotShadowban: 'email_dot_shadowban',
} as const;

type MaintenanceConfig = {
  enabled: boolean;
  message: string;
  updatedAt: string | null;
};

type SupportConfig = {
  email: string;
  updatedAt: string | null;
};

type AnnouncementConfig = {
  enabled: boolean;
  message: string;
  updatedAt: string | null;
};

type EmailDotShadowbanConfig = {
  enabled: boolean;
  updatedAt: string | null;
};

async function readSetting(key: string) {
  const rows = await prisma.$queryRaw<Array<{ value: unknown; updated_at: Date | string | null }>>(Prisma.sql`
    SELECT value, updated_at
    FROM admin_settings
    WHERE key = ${key}
    LIMIT 1
  `);

  const row = rows[0];
  const value = row?.value && typeof row.value === 'object' && !Array.isArray(row.value)
    ? (row.value as Record<string, unknown>)
    : {};
  const updatedAt = row?.updated_at ? new Date(row.updated_at).toISOString() : null;
  return { value, updatedAt };
}

async function writeSetting(key: string, value: Prisma.InputJsonValue) {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO admin_settings (key, value, created_at, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, NOW(), NOW())
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `);
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const [maintenance, support, announcement, emailDotShadowban] = await Promise.all([
      readSetting(SETTINGS.maintenance),
      readSetting(SETTINGS.support),
      readSetting(SETTINGS.announcement),
      readSetting(SETTINGS.emailDotShadowban),
    ]);

    const config = {
      maintenance: {
        enabled: maintenance.value.enabled === true,
        message: typeof maintenance.value.message === 'string' ? maintenance.value.message : '',
        updatedAt: maintenance.updatedAt,
      } satisfies MaintenanceConfig,
      support: {
        email: typeof support.value.email === 'string' && support.value.email.trim() ? support.value.email : 'support@aikompute.com',
        updatedAt: support.updatedAt,
      } satisfies SupportConfig,
      announcement: {
        enabled: announcement.value.enabled === true,
        message: typeof announcement.value.message === 'string' ? announcement.value.message : '',
        updatedAt: announcement.updatedAt,
      } satisfies AnnouncementConfig,
      emailDotShadowban: {
        // Defaults to false (off) when no row exists in DB
        enabled: emailDotShadowban.value.enabled === true,
        updatedAt: emailDotShadowban.updatedAt,
      } satisfies EmailDotShadowbanConfig,
    };

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Admin settings fetch error:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const body = await req.json();
    const actor = typeof body?.actor === 'string' && body.actor.trim() ? body.actor.trim() : 'admin';

    const tasks: Promise<unknown>[] = [];
    const changes: Record<string, unknown> = {};

    if (body?.maintenance) {
      const enabled = body.maintenance.enabled === true;
      const message = typeof body.maintenance.message === 'string' ? body.maintenance.message.slice(0, 280) : '';
      tasks.push(writeSetting(SETTINGS.maintenance, {
        enabled,
        message,
        updatedAt: new Date().toISOString(),
      }));
      changes.maintenance = { enabled, message };
    }

    if (body?.support) {
      const email = typeof body.support.email === 'string' && body.support.email.trim()
        ? body.support.email.trim().slice(0, 120)
        : 'support@aikompute.com';
      tasks.push(writeSetting(SETTINGS.support, {
        email,
        updatedAt: new Date().toISOString(),
      }));
      changes.support = { email };
    }

    if (body?.announcement) {
      const enabled = body.announcement.enabled === true;
      const message = typeof body.announcement.message === 'string' ? body.announcement.message.slice(0, 240) : '';
      tasks.push(writeSetting(SETTINGS.announcement, {
        enabled,
        message,
        updatedAt: new Date().toISOString(),
      }));
      changes.announcement = { enabled, message };
    }

    if (typeof body?.emailDotShadowban?.enabled === 'boolean') {
      const enabled = body.emailDotShadowban.enabled === true;
      tasks.push(writeSetting(SETTINGS.emailDotShadowban, {
        enabled,
        updatedAt: new Date().toISOString(),
      }));
      changes.emailDotShadowban = { enabled };
    }

    if (tasks.length === 0) {
      return NextResponse.json({ error: 'No settings provided' }, { status: 400 });
    }

    await Promise.all(tasks);

    await recordAdminAction({
      action: 'settings.update',
      req,
      metadata: { actor, changes } as Prisma.InputJsonValue,
    });

    const [maintenance, support, announcement, emailDotShadowban] = await Promise.all([
      readSetting(SETTINGS.maintenance),
      readSetting(SETTINGS.support),
      readSetting(SETTINGS.announcement),
      readSetting(SETTINGS.emailDotShadowban),
    ]);

    return NextResponse.json({
      success: true,
      config: {
        maintenance: {
          enabled: maintenance.value.enabled === true,
          message: typeof maintenance.value.message === 'string' ? maintenance.value.message : '',
          updatedAt: maintenance.updatedAt,
        },
        support: {
          email: typeof support.value.email === 'string' && support.value.email.trim() ? support.value.email : 'support@aikompute.com',
          updatedAt: support.updatedAt,
        },
        announcement: {
          enabled: announcement.value.enabled === true,
          message: typeof announcement.value.message === 'string' ? announcement.value.message : '',
          updatedAt: announcement.updatedAt,
        },
        emailDotShadowban: {
          enabled: emailDotShadowban.value.enabled === true,
          updatedAt: emailDotShadowban.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Admin settings update error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
