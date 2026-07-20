/**
 * Hidden chat credential provisioning and management.
 *
 * On first chat use, a dedicated OmniRoute API key is created for the user,
 * encrypted, and stored in the chat_credentials table. This key is separate
 * from the user's visible dashboard keys — it does not count against plan
 * key limits, is never shown in the UI, and is never returned to the browser.
 *
 * The key inherits the user's current plan limits, model permissions, and
 * lock/shadow scopes, and is updated whenever the plan or account status
 * changes (via the same reconciliation paths as normal keys).
 */

import prisma from "./db";
import {
  createOmniRouteKey,
  deleteOmniRouteKey,
  planKeyLimits,
  updateKeyLimits,
} from "./omniroute";
import { encryptApiKey, decryptApiKey } from "./chatCrypto";
import type { User } from "@prisma/client";

const CHAT_KEY_NAME = "Website Chat (Hidden)";

/**
 * Ensure a hidden chat credential exists for the user.
 * Creates one in OmniRoute if missing, encrypts the raw key, and applies
 * the user's current plan limits. Idempotent — returns the existing record
 * if one already exists.
 */
export async function ensureChatCredential(
  user: User & {
    plan: {
      id: string;
      requestsPerDay: number;
      requestsPerMinute: number;
      requestsPerMonth?: number;
      allowedModels: string;
    } | null;
  },
) {
  // Check for existing credential
  const existing = await prisma.chatCredential.findUnique({
    where: { userId: user.id },
  });

  if (existing) {
    return existing;
  }

  // Determine scopes from account status
  const scopes: string[] = [];
  if (user.isShadowLocked) scopes.push("shadow_lock");
  if (user.isShadowBanned) scopes.push("shadow_ban");

  // Create the key in OmniRoute
  const keyName = `${user.email} - ${CHAT_KEY_NAME}`;
  const omniKey = await createOmniRouteKey(keyName, scopes);

  // Encrypt the raw key
  const { ciphertext, keyVersion } = encryptApiKey(omniKey.key);

  // Store encrypted credential
  const credential = await prisma.chatCredential.create({
    data: {
      userId: user.id,
      omnirouteKeyId: omniKey.id,
      encryptedKey: ciphertext,
      keyVersion,
    },
  });

  // Apply plan limits (non-fatal — key works uncapped if this fails)
  try {
    if (user.plan) {
      await updateKeyLimits(omniKey.id, planKeyLimits(user.plan));
    }
  } catch (err) {
    console.error(
      "[chat-credential] Failed to apply plan limits (non-fatal):",
      err,
    );
  }

  return credential;
}

/**
 * Get the decrypted OmniRoute API key for the user's chat credential.
 * Throws if no credential exists — callers must ensureChatCredential first.
 */
export async function getDecryptedChatApiKey(userId: string): Promise<string> {
  const credential = await prisma.chatCredential.findUnique({
    where: { userId },
  });

  if (!credential) {
    throw new Error(
      "No chat credential found — call ensureChatCredential first",
    );
  }

  return decryptApiKey(credential.encryptedKey, credential.keyVersion);
}

/**
 * Get the OmniRoute key ID for the user's chat credential.
 * Used for updating limits and revocation.
 */
export async function getChatOmniRouteKeyId(
  userId: string,
): Promise<string | null> {
  const credential = await prisma.chatCredential.findUnique({
    where: { userId },
  });
  return credential?.omnirouteKeyId ?? null;
}

/**
 * Update the hidden chat key's limits when the user's plan changes.
 * Called from Stripe webhook and admin plan-change paths.
 */
export async function syncChatKeyLimits(
  userId: string,
  plan: {
    requestsPerDay: number;
    requestsPerMinute: number;
    requestsPerMonth?: number;
    allowedModels: string;
  },
): Promise<void> {
  const omniRouteKeyId = await getChatOmniRouteKeyId(userId);
  if (!omniRouteKeyId) return;

  try {
    await updateKeyLimits(omniRouteKeyId, planKeyLimits(plan));
  } catch (err) {
    console.error("[chat-credential] Failed to sync key limits:", err);
  }
}

/**
 * Update the hidden chat key's scopes when the user is locked/unlocked
 * or shadow-banned/unbanned.
 */
export async function syncChatKeyScopes(
  userId: string,
  scopes: string[],
): Promise<void> {
  const omniRouteKeyId = await getChatOmniRouteKeyId(userId);
  if (!omniRouteKeyId) return;

  try {
    await updateKeyLimits(omniRouteKeyId, { scopes });
  } catch (err) {
    console.error("[chat-credential] Failed to sync key scopes:", err);
  }
}

/**
 * Revoke and delete the hidden chat credential.
 * Called during account deletion.
 */
export async function revokeChatCredential(userId: string): Promise<void> {
  const credential = await prisma.chatCredential.findUnique({
    where: { userId },
  });

  if (!credential) return;

  // Delete the portal record first
  await prisma.chatCredential.delete({ where: { userId } });

  // Best-effort delete in OmniRoute (404 = already gone, fine)
  try {
    await deleteOmniRouteKey(credential.omnirouteKeyId);
  } catch (err) {
    console.error(
      "[chat-credential] OmniRoute delete failed (orphan will be reconciled):",
      err,
    );
  }
}
