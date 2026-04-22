import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createOmniRouteKey, deleteOmniRouteKey, updateKeyLimits } from '@/lib/omniroute';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';
// GET /api/keys — list user's API keys
export async function GET() {
  try {
    const user = await requireAuth();
    const keys = await prisma.userApiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ keys });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/keys — create new API key
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { name } = await req.json();

    // Enforce key limit based on plan
    const keyCount = await prisma.userApiKey.count({ where: { userId: user.id } });
    const maxKeys = user.planId === 'free' ? 2 : user.planId === 'basic' ? 5 : 20;
    if (keyCount >= maxKeys) {
      return NextResponse.json(
        { error: `Maximum ${maxKeys} API keys allowed on your plan` },
        { status: 403 }
      );
    }

    // Create key in OmniRoute
    const keyName = `${user.email} - ${name || 'Default Key'}`;
    const omniKey = await createOmniRouteKey(keyName);

    // Set limits based on user's plan
    const userWithPlan = await prisma.user.findUnique({
      where: { id: user.id },
      include: { plan: true },
    });

    if (userWithPlan?.plan) {
      await updateKeyLimits(omniKey.id, {
        maxRequestsPerDay: userWithPlan.plan.requestsPerDay,
        maxRequestsPerMinute: userWithPlan.plan.requestsPerMinute,
        allowedModels: userWithPlan.plan.allowedModels === '*' 
          ? [] 
          : JSON.parse(userWithPlan.plan.allowedModels),
      });
    }

    // Store mapping
    const userKey = await prisma.userApiKey.create({
      data: {
        userId: user.id,
        omnirouteKeyId: omniKey.id,
        name: name || 'Default Key',
        lastFour: omniKey.key.slice(-4),
      },
    });

    return NextResponse.json({
      key: userKey,
      rawKey: omniKey.key, // Only returned once!
      message: 'Save this key — it will not be shown again.',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Key creation error:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}

// DELETE /api/keys — revoke an API key
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { keyId } = await req.json();

    const key = await prisma.userApiKey.findFirst({
      where: { id: keyId, userId: user.id },
    });

    if (!key) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    // Revoke in OmniRoute
    await deleteOmniRouteKey(key.omnirouteKeyId);

    // Remove mapping
    await prisma.userApiKey.delete({ where: { id: keyId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
