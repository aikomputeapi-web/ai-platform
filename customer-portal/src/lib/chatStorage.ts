/**
 * S3-compatible private object storage adapter for chat attachments.
 *
 * Object keys are strictly scoped: attachments/{userId}/{conversationId}/{attachmentId}
 * This ensures user isolation and makes conversation deletion a simple prefix delete.
 *
 * All objects are private — no public ACLs. Downloads use short-lived presigned URLs
 * generated server-side and never exposed permanently. Uploads go through the portal
 * server (not presigned PUT) so MIME validation and size limits are enforced before
 * the object is written.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const BUCKET = process.env.CHAT_S3_BUCKET || "aikompute-chat-attachments";
const REGION =
  process.env.CHAT_S3_REGION || process.env.AWS_REGION || "us-east-1";
const ENDPOINT = process.env.CHAT_S3_ENDPOINT || undefined;
const FORCE_PATH_STYLE = process.env.CHAT_S3_FORCE_PATH_STYLE === "true";
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: REGION,
    ...(ENDPOINT
      ? { endpoint: ENDPOINT, forcePathStyle: FORCE_PATH_STYLE }
      : {}),
  });
  return cachedClient;
}

export function buildStorageKey(
  userId: string,
  conversationId: string,
  attachmentId: string,
): string {
  // Strict scoping: no path traversal possible because all three IDs are server-generated UUIDs
  return `attachments/${userId}/${conversationId}/${attachmentId}`;
}

export function generateAttachmentId(): string {
  return randomUUID();
}

export async function uploadAttachment(
  userId: string,
  conversationId: string,
  attachmentId: string,
  body: Buffer,
  mimeType: string,
): Promise<string> {
  const key = buildStorageKey(userId, conversationId, attachmentId);
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: mimeType,
      // Private — no public read access
      ACL: "private",
    }),
  );
  return key;
}

export async function getSignedDownloadUrl(
  storageKey: string,
  filename?: string,
): Promise<string> {
  const client = getClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      ...(filename
        ? {
            ResponseContentDisposition: `attachment; filename="${filename.replace(/["\\]/g, "")}"`,
          }
        : {}),
    }),
    { expiresIn: SIGNED_URL_TTL_SECONDS },
  );
}

export async function downloadAttachment(storageKey: string): Promise<Buffer> {
  const client = getClient();
  const response = await client.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: storageKey }),
  );
  if (!response.Body) throw new Error("Empty response body from storage");
  // @aws-sdk/client-s3 v3 stream → Buffer
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteAttachment(storageKey: string): Promise<void> {
  const client = getClient();
  try {
    await client.send(
      new DeleteObjectCommand({ Bucket: BUCKET, Key: storageKey }),
    );
  } catch (err) {
    // Idempotent — object may already be gone
    console.error("[storage] Delete failed (non-fatal):", err);
  }
}

/**
 * Delete all attachments for a conversation by listing and batch-deleting
 * objects under the conversation prefix. Called when a conversation is deleted.
 */
export async function deleteConversationAttachments(
  userId: string,
  conversationId: string,
): Promise<void> {
  const client = getClient();
  const prefix = `attachments/${userId}/${conversationId}/`;

  // List all objects under the prefix
  const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
  const listResponse = await client.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }),
  );

  const objects = (listResponse.Contents || [])
    .map((obj) => ({ Key: obj.Key! }))
    .filter((o) => o.Key);
  if (objects.length === 0) return;

  // Delete in batches of 1000 (S3 limit)
  for (let i = 0; i < objects.length; i += 1000) {
    const batch = objects.slice(i, i + 1000);
    try {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: { Objects: batch },
        }),
      );
    } catch (err) {
      console.error("[storage] Batch delete failed (non-fatal):", err);
    }
  }
}
