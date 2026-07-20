/**
 * AES-256-GCM envelope encryption for hidden OmniRoute chat credentials.
 *
 * The portal stores a per-user OmniRoute API key (created automatically for
 * website chat) encrypted at rest. The key material is never logged, never
 * sent to the browser, and only decrypted server-side at the moment a chat
 * request is forwarded to OmniRoute.
 *
 * The envelope format is: base64(version:iv:ciphertext:authTag).
 * Key rotation is supported via the CHAT_KEY_ENCRYPTION_KEY environment
 * variable, which may contain multiple comma-separated keys. The first key
 * is used for encryption; all keys are tried for decryption in order.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const ENCRYPTION_KEY_ENV = "CHAT_KEY_ENCRYPTION_KEY";
const FALLBACK_DEV_KEY = "dev-chat-encryption-key-change-in-production";
const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // GCM standard nonce length

let cachedKeys: Buffer[] | null = null;

function getEncryptionKeys(): Buffer[] {
  if (cachedKeys) return cachedKeys;

  const raw = process.env[ENCRYPTION_KEY_ENV] || "";
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `${ENCRYPTION_KEY_ENV} environment variable is required in production`,
      );
    }
    console.warn(
      `[chat-encryption] WARNING: ${ENCRYPTION_KEY_ENV} is not set. Using insecure dev key.`,
    );
    cachedKeys = [scryptSync(FALLBACK_DEV_KEY, "chat-salt", KEY_LENGTH)];
    return cachedKeys;
  }

  cachedKeys = raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => scryptSync(k, "chat-salt", KEY_LENGTH));

  if (cachedKeys.length === 0) {
    throw new Error(
      `${ENCRYPTION_KEY_ENV} must contain at least one non-empty key`,
    );
  }

  return cachedKeys;
}

/** Force re-reading keys from the environment (used in tests). */
export function resetEncryptionKeyCache(): void {
  cachedKeys = null;
}

export function encryptApiKey(plaintext: string): {
  ciphertext: string;
  keyVersion: number;
} {
  const keys = getEncryptionKeys();
  const key = keys[0];
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const version = 1;

  const envelope = Buffer.concat([
    Buffer.from([version]),
    iv,
    encrypted,
    authTag,
  ]);

  return { ciphertext: envelope.toString("base64"), keyVersion: version };
}

export function decryptApiKey(
  ciphertext: string,
  _expectedVersion?: number,
): string {
  const keys = getEncryptionKeys();
  const envelope = Buffer.from(ciphertext, "base64");

  // Envelope layout: 1 byte version + 12 bytes IV + N bytes ciphertext + 16 bytes authTag
  if (envelope.length < 1 + IV_LENGTH + 16) {
    throw new Error("Invalid encrypted credential envelope: too short");
  }

  const iv = envelope.subarray(1, 1 + IV_LENGTH);
  const authTag = envelope.subarray(envelope.length - 16);
  const encrypted = envelope.subarray(1 + IV_LENGTH, envelope.length - 16);

  let lastError: Error | null = null;

  for (const key of keys) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      return decrypted.toString("utf8");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new Error(
    `Failed to decrypt chat credential: ${lastError?.message || "no matching key"}`,
  );
}
