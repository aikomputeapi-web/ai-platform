import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import {
  deleteOmniRouteKey,
  getUsageAnalytics,
  updateKeyLimits,
} from "@/lib/omniroute";
import {
  createSessionToken,
  generateVerifyToken,
  hashPassword,
} from "@/lib/auth";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import {
  adminForbidden,
  recordAdminAction,
  verifyAdminAccess,
} from "@/lib/admin";
import { ensureSubscriptionCanceled } from "@/lib/stripe";
import { calculateOfficialCost } from "@/lib/models";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

interface AuditLogRow {
  id: string;
  action: string;
  actor: string;
  targetUserId: string | null;
  targetUserEmail: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: Date;
}

interface ApiKeyUsage {
  apiKeyId: string;
  apiKey?: string;
  apiKeyName?: string;
  historicalApiKeyNames?: string[];
  requests?: number;
  totalTokens?: number;
  cost?: number;
  totalCost?: number;
  promptTokens?: number;
  completionTokens?: number;
  byModel?: { model: string; requests: number }[];
}

function formatRange(range: string | null) {
  return range || "30d";
}

// Credential columns must never leave the server, even in admin responses.
function stripSensitiveUserFields(user: object | null) {
  if (!user) return user;
  const safe = { ...user } as Record<string, unknown>;
  delete safe.passwordHash;
  delete safe.verifyToken;
  delete safe.resetToken;
  delete safe.resetTokenExp;
  return safe;
}

function normalizeUsageLookupKey(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function indexApiKeyUsage(
  usageByKeyId: Record<string, ApiKeyUsage>,
  usageByName: Map<string, ApiKeyUsage>,
  entry: ApiKeyUsage,
) {
  if (entry.apiKeyId) {
    usageByKeyId[entry.apiKeyId] = entry;
  }

  const apiKeyNames = [
    entry.apiKeyName,
    entry.apiKey,
    ...(entry.historicalApiKeyNames || []),
  ];
  for (const name of apiKeyNames) {
    const normalized = normalizeUsageLookupKey(name);
    if (normalized && !usageByName.has(normalized)) {
      usageByName.set(normalized, entry);
    }
  }
}

function resolvePortalKeyUsage(
  usageByKeyId: Record<string, ApiKeyUsage>,
  usageByName: Map<string, ApiKeyUsage>,
  apiKeyId: string,
  portalKeyName: string,
) {
  const byId = usageByKeyId[apiKeyId];
  if (byId) return byId;

  const byName = usageByName.get(normalizeUsageLookupKey(portalKeyName));
  return byName || null;
}

async function buildUserDetail(userId: string, range: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      plan: true,
      apiKeys: {
        orderBy: { createdAt: "desc" },
      },
      payments: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    return null;
  }

  const keyIds = user.apiKeys.map((key) => key.omnirouteKeyId).filter(Boolean);
  const analytics =
    keyIds.length > 0 ? await getUsageAnalytics(range, keyIds) : null;

  const usageByKeyId: Record<string, ApiKeyUsage> = {};
  const usageByName = new Map<string, ApiKeyUsage>();
  for (const entry of analytics?.byApiKey || []) {
    indexApiKeyUsage(usageByKeyId, usageByName, entry);
  }

  const apiKeys = user.apiKeys.map((key) => {
    const usage =
      resolvePortalKeyUsage(
        usageByKeyId,
        usageByName,
        key.omnirouteKeyId,
        `${user.email} - ${key.name}`,
      ) || null;

    if (usage) {
      let officialKeyCost = usage.cost || usage.totalCost || 0;
      if (
        officialKeyCost === 0 &&
        (usage.promptTokens || usage.completionTokens)
      ) {
        const topModel = usage.byModel?.sort(
          (a: any, b: any) => b.requests - a.requests,
        )[0]?.model;
        officialKeyCost = calculateOfficialCost(
          topModel,
          usage.promptTokens || 0,
          usage.completionTokens || 0,
        );
      }
      usage.totalCost = officialKeyCost;
      usage.cost = officialKeyCost;
    }

    return {
      id: key.id,
      name: key.name,
      lastFour: key.lastFour,
      isActive: key.isActive,
      createdAt: key.createdAt,
      usage,
    };
  });

  const keyUsages = apiKeys
    .map((key) => key.usage)
    .filter((entry): entry is ApiKeyUsage => Boolean(entry));
  const topModelsMap: Record<string, number> = {};
  for (const keyUsage of keyUsages) {
    for (const model of keyUsage.byModel || []) {
      topModelsMap[model.model] =
        (topModelsMap[model.model] || 0) + (model.requests || 0);
    }
  }

  // Calculate official total cost based on model breakdown for precision
  let calculatedCost = 0;
  if (analytics?.byModel) {
    for (const m of analytics.byModel) {
      calculatedCost += calculateOfficialCost(
        m.model,
        m.promptTokens || 0,
        m.completionTokens || 0,
      );
    }
  } else {
    calculatedCost = keyUsages.reduce(
      (sum, entry) => sum + (entry.totalCost || 0),
      0,
    );
  }

  const totalPaidCents = user.payments
    .filter(
      (payment) =>
        payment.status === "succeeded" || payment.status === "completed",
    )
    .reduce((sum, payment) => sum + payment.amountCents, 0);

  const recentAudit = await prisma.$queryRaw<AuditLogRow[]>(Prisma.sql`
    SELECT
      id,
      action,
      actor,
      target_user_id AS "targetUserId",
      target_user_email AS "targetUserEmail",
      metadata,
      ip_address AS "ipAddress",
      created_at AS "createdAt"
    FROM "audit_logs"
    WHERE target_user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 12
  `);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    isLocked: user.isLocked,
    isShadowLocked: user.isShadowLocked,
    isShadowBanned: user.isShadowBanned,
    adminNote: user.adminNote,
    stripeCustomerId: user.stripeCustomerId,
    plan: user.plan,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    apiKeys,
    payments: user.payments.map((payment) => ({
      id: payment.id,
      amountCents: payment.amountCents,
      planId: payment.planId,
      status: payment.status,
      createdAt: payment.createdAt,
    })),
    usage: {
      totalRequests: keyUsages.reduce(
        (sum, entry) => sum + (entry.requests || 0),
        0,
      ),
      totalTokens: keyUsages.reduce(
        (sum, entry) => sum + (entry.totalTokens || 0),
        0,
      ),
      totalCost: calculatedCost,
      promptTokens: keyUsages.reduce(
        (sum, entry) => sum + (entry.promptTokens || 0),
        0,
      ),
      completionTokens: keyUsages.reduce(
        (sum, entry) => sum + (entry.completionTokens || 0),
        0,
      ),
      matchedRequests: keyUsages.reduce(
        (sum, entry) => sum + (entry.requests || 0),
        0,
      ),
      unmatchedRequests: Math.max(
        0,
        Number(analytics?.summary?.totalRequests || 0) -
          keyUsages.reduce((sum, entry) => sum + (entry.requests || 0), 0),
      ),
      coveragePct:
        Number(analytics?.summary?.totalRequests || 0) > 0
          ? Number(
              (
                (keyUsages.reduce(
                  (sum, entry) => sum + (entry.requests || 0),
                  0,
                ) /
                  Number(analytics?.summary?.totalRequests || 1)) *
                100
              ).toFixed(2),
            )
          : 0,
      topModels: Object.entries(topModelsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([model, requests]) => ({ model, requests })),
    },
    totalPaidCents,
    recentAudit,
    range,
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const { id } = await params;
    const range = formatRange(req.nextUrl.searchParams.get("range"));
    const detail = await buildUserDetail(id, range);

    if (!detail) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: detail, range });
  } catch (error) {
    console.error("Admin user detail error:", error);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const action = String(body?.action || "");

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        plan: true,
        apiKeys: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let response: Record<string, unknown> = {};
    let impersonationToken: string | null = null;

    switch (action) {
      case "lock": {
        const updated = await prisma.user.update({
          where: { id },
          data: {
            isLocked: true,
            adminNote: body?.note?.trim() || user.adminNote,
          },
          include: { plan: true, apiKeys: true, payments: true },
        });
        await recordAdminAction({
          action: "user.locked",
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
          metadata: body?.note ? { note: body.note } : null,
        });
        response = { user: stripSensitiveUserFields(updated) };
        break;
      }
      case "unlock": {
        const updated = await prisma.user.update({
          where: { id },
          data: {
            isLocked: false,
            isShadowLocked: false,
            isShadowBanned: false,
          },
          include: { plan: true, apiKeys: true, payments: true },
        });

        // Clear shadow scopes from all user's keys in OmniRoute
        for (const key of user.apiKeys) {
          try {
            await updateKeyLimits(key.omnirouteKeyId, { scopes: [] });
          } catch (err) {
            console.error(`Failed to clear scopes for key ${key.id}:`, err);
          }
        }

        // Sync hidden chat key scopes
        try {
          const { syncChatKeyScopes } = await import("@/lib/chatCredential");
          await syncChatKeyScopes(id, []);
        } catch (err) {
          console.error(`Failed to sync chat key scopes for ${id}:`, err);
        }

        await recordAdminAction({
          action: "user.unlocked",
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
        });
        response = { user: stripSensitiveUserFields(updated) };
        break;
      }
      case "shadowBan": {
        const active = Boolean(body?.active);
        const updated = await prisma.user.update({
          where: { id },
          data: {
            isShadowBanned: active,
          },
          include: { plan: true, apiKeys: true, payments: true },
        });

        const scopes: string[] = [];
        if (updated.isShadowLocked) scopes.push("shadow_lock");
        if (updated.isShadowBanned) scopes.push("shadow_ban");

        for (const key of user.apiKeys) {
          try {
            await updateKeyLimits(key.omnirouteKeyId, { scopes });
          } catch (err) {
            console.error(`Failed to update scopes for key ${key.id}:`, err);
          }
        }

        // Sync hidden chat key scopes
        try {
          const { syncChatKeyScopes } = await import("@/lib/chatCredential");
          await syncChatKeyScopes(id, scopes);
        } catch (err) {
          console.error(`Failed to sync chat key scopes for ${id}:`, err);
        }

        await recordAdminAction({
          action: active ? "user.shadow_banned" : "user.shadow_unbanned",
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
        });
        response = { user: stripSensitiveUserFields(updated) };
        break;
      }
      case "shadowLock": {
        const active = Boolean(body?.active);
        const updated = await prisma.user.update({
          where: { id },
          data: {
            isShadowLocked: active,
          },
          include: { plan: true, apiKeys: true, payments: true },
        });

        const scopes: string[] = [];
        if (updated.isShadowLocked) scopes.push("shadow_lock");
        if (updated.isShadowBanned) scopes.push("shadow_ban");

        for (const key of user.apiKeys) {
          try {
            await updateKeyLimits(key.omnirouteKeyId, { scopes });
          } catch (err) {
            console.error(`Failed to update scopes for key ${key.id}:`, err);
          }
        }

        // Sync hidden chat key scopes
        try {
          const { syncChatKeyScopes } = await import("@/lib/chatCredential");
          await syncChatKeyScopes(id, scopes);
        } catch (err) {
          console.error(`Failed to sync chat key scopes for ${id}:`, err);
        }

        await recordAdminAction({
          action: active ? "user.shadow_locked" : "user.shadow_unlocked",
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
        });
        response = { user: stripSensitiveUserFields(updated) };
        break;
      }
      case "plan": {
        const planId = String(body?.planId || "");
        if (!planId) {
          return NextResponse.json(
            { error: "planId is required" },
            { status: 400 },
          );
        }
        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) {
          return NextResponse.json(
            { error: "Plan not found" },
            { status: 404 },
          );
        }
        const updated = await prisma.user.update({
          where: { id },
          data: { planId },
          include: { plan: true, apiKeys: true, payments: true },
        });
        await recordAdminAction({
          action: "user.plan_changed",
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
          metadata: { planId, planName: plan.name },
        });
        response = { user: stripSensitiveUserFields(updated) };
        break;
      }
      case "note": {
        const note = String(body?.note || "").trim();
        const updated = await prisma.user.update({
          where: { id },
          data: { adminNote: note || null },
          include: { plan: true, apiKeys: true, payments: true },
        });
        await recordAdminAction({
          action: "user.note_updated",
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
          metadata: note ? { note } : null,
        });
        response = { user: stripSensitiveUserFields(updated) };
        break;
      }
      case "revokeKeys": {
        // Only mark keys inactive once OmniRoute confirms revocation — a
        // swallowed failure here leaves the key live on the proxy while the
        // portal shows it revoked, until the reconciler's inactive-mapping
        // sweep catches it on a later cycle. (deleteOmniRouteKey treats 404
        // as success, so retrying after a partial failure converges.)
        const activeKeys = user.apiKeys.filter((key) => key.isActive);
        const revocations = await Promise.allSettled(
          activeKeys.map((key) => deleteOmniRouteKey(key.omnirouteKeyId)),
        );
        const failed = revocations.filter(
          (r): r is PromiseRejectedResult => r.status === "rejected",
        );
        if (failed.length > 0) {
          for (const f of failed)
            console.error(
              "Admin revokeKeys: failed to revoke OmniRoute key:",
              f.reason,
            );
          return NextResponse.json(
            {
              error: `Failed to revoke ${failed.length} of ${activeKeys.length} keys in OmniRoute. No keys were marked revoked — please try again.`,
            },
            { status: 502 },
          );
        }
        await prisma.userApiKey.updateMany({
          where: { userId: id },
          data: { isActive: false },
        });
        const updated = await prisma.user.findUnique({
          where: { id },
          include: { plan: true, apiKeys: true, payments: true },
        });
        await recordAdminAction({
          action: "user.keys_revoked",
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
          metadata: { revokedKeys: activeKeys.length },
        });
        response = { user: stripSensitiveUserFields(updated) };
        break;
      }
      case "resendVerification": {
        if (user.emailVerified) {
          return NextResponse.json(
            { error: "User is already verified" },
            { status: 400 },
          );
        }

        // Always rotate: reusing user.verifyToken would keep alive tokens
        // minted before the crypto.randomBytes fix (predictable Math.random
        // values) and any previously emailed link.
        const verifyToken = generateVerifyToken();
        const updated = await prisma.user.update({
          where: { id },
          data: { verifyToken },
          include: { plan: true, apiKeys: true, payments: true },
        });
        // Send failures are reported via the boolean, not exceptions —
        // ignoring it would tell the admin "sent" when nothing went out.
        // The token is already rotated, but retrying rotates and resends.
        const verificationSent = await sendVerificationEmail(
          user.email,
          verifyToken,
        );
        if (!verificationSent) {
          return NextResponse.json(
            {
              error:
                "Failed to send the verification email. No email was delivered — please try again.",
            },
            { status: 502 },
          );
        }
        await recordAdminAction({
          action: "support.verification_resent",
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
        });
        response = { user: stripSensitiveUserFields(updated) };
        break;
      }
      case "resetPassword": {
        const resetToken = generateVerifyToken();
        const resetTokenExp = new Date();
        resetTokenExp.setHours(resetTokenExp.getHours() + 1);

        const updated = await prisma.user.update({
          where: { id },
          data: { resetToken, resetTokenExp },
          include: { plan: true, apiKeys: true, payments: true },
        });
        const resetSent = await sendPasswordResetEmail(user.email, resetToken);
        if (!resetSent) {
          return NextResponse.json(
            {
              error:
                "Failed to send the password reset email. No email was delivered — please try again.",
            },
            { status: 502 },
          );
        }
        await recordAdminAction({
          action: "support.password_reset_sent",
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
        });
        response = { user: stripSensitiveUserFields(updated) };
        break;
      }
      case "impersonate": {
        impersonationToken = await createSessionToken(user.id);
        await recordAdminAction({
          action: "support.impersonate",
          req,
          targetUserId: user.id,
          targetUserEmail: user.email,
        });
        response = { url: "/dashboard" };
        break;
      }
      default:
        return NextResponse.json(
          { error: "Unsupported action" },
          { status: 400 },
        );
    }

    const result = NextResponse.json({ success: true, ...response });
    if (impersonationToken) {
      result.cookies.set("portal_impersonation_session", impersonationToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      });
    }
    return result;
  } catch (error) {
    console.error("Admin user action error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await verifyAdminAccess(req))) {
    return adminForbidden();
  }

  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { apiKeys: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Abort the soft-delete if any revocation fails: the anonymized row keeps
    // its key mappings but flips them inactive — an ignored failure leaves
    // the key live on the proxy until the reconciler's inactive-mapping
    // sweep catches it on a later cycle. 404 counts as success, so retries
    // converge.
    const revocations = await Promise.allSettled(
      user.apiKeys.map((key) => deleteOmniRouteKey(key.omnirouteKeyId)),
    );
    const failed = revocations.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    if (failed.length > 0) {
      for (const f of failed)
        console.error(
          "Admin user delete: failed to revoke OmniRoute key:",
          f.reason,
        );
      return NextResponse.json(
        {
          error: `Failed to revoke ${failed.length} of ${user.apiKeys.length} keys in OmniRoute. The user was not deleted — please try again.`,
        },
        { status: 502 },
      );
    }

    // Cancel any active Stripe subscription before anonymizing — the update
    // below nulls stripeCustomerId, the only field the webhook resolves users
    // by, so a surviving subscription would keep billing with no way to map
    // its events back. Same guard as the self-serve account delete route.
    if (user.stripeSubscriptionId) {
      try {
        await ensureSubscriptionCanceled(user.stripeSubscriptionId);
      } catch (e) {
        console.error(
          "Admin user delete: failed to cancel Stripe subscription:",
          e,
        );
        return NextResponse.json(
          {
            error:
              "Failed to cancel the user's Stripe subscription. The user was not deleted — please try again.",
          },
          { status: 502 },
        );
      }
    }

    await prisma.$transaction([
      prisma.userApiKey.updateMany({
        where: { userId: id },
        data: { isActive: false },
      }),
      prisma.user.update({
        where: { id },
        data: {
          email: `${user.email}.deleted.${user.id.slice(0, 8)}`,
          passwordHash: await hashPassword(generateVerifyToken()),
          name: null,
          emailVerified: false,
          isLocked: true,
          adminNote: null,
          verifyToken: null,
          resetToken: null,
          resetTokenExp: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          planId: "free",
        },
      }),
    ]);

    await recordAdminAction({
      action: "user.deleted",
      req,
      targetUserId: user.id,
      targetUserEmail: user.email,
      metadata: { apiKeysRevoked: user.apiKeys.length },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin user delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 },
    );
  }
}
