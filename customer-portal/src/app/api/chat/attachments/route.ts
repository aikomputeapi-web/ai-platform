import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  validateAttachmentBatch,
  type ValidatedAttachment,
} from "@/lib/chatAttachmentPolicy";
import {
  uploadAttachment,
  generateAttachmentId,
  buildStorageKey,
} from "@/lib/chatStorage";
import { extractDocumentText } from "@/lib/chatExtraction";

export const dynamic = "force-dynamic";

const INLINE_EXTRACTION_MAX_BYTES = 25 * 1024 * 1024; // Extract inline up to 25 MB

/**
 * POST /api/chat/attachments — upload one or more files for a conversation.
 *
 * Multipart form data:
 *   - conversationId: string (required)
 *   - files: File[] (one or more)
 *
 * Files are validated, uploaded to S3, and document text is extracted inline
 * for smaller files. The response includes attachment metadata and extraction
 * status for each file.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const formData = await req.formData();

    const conversationId = formData.get("conversationId") as string;
    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 },
      );
    }

    // Verify conversation ownership
    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, userId: user.id },
    });
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    // Collect all files from the form data
    const files: File[] = [];
    for (const [, value] of formData.entries()) {
      if (value instanceof File) files.push(value);
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Validate the batch
    const fileInfos = files.map((f) => ({
      filename: f.name,
      mimeType: f.type || "application/octet-stream",
      bytes: f.size,
    }));
    const { valid, errors } = validateAttachmentBatch(fileInfos);

    if (errors.length > 0 && valid.length === 0) {
      return NextResponse.json(
        { error: errors[0].reason, details: errors },
        { status: 400 },
      );
    }

    // Upload valid files and create attachment records
    const results: Array<{
      id: string;
      filename: string;
      mimeType: string;
      bytes: number;
      kind: string;
      extractionStatus: string;
    }> = [];

    for (let i = 0; i < valid.length; i++) {
      const validated = valid[i];
      const file = files.find(
        (f) => f.name === validated.filename && f.size === validated.bytes,
      );
      if (!file) continue;

      const attachmentId = generateAttachmentId();
      const buffer = Buffer.from(await file.arrayBuffer());

      // Upload to S3
      const storageKey = buildStorageKey(user.id, conversationId, attachmentId);
      try {
        await uploadAttachment(
          user.id,
          conversationId,
          attachmentId,
          buffer,
          validated.mimeType,
        );
      } catch (err) {
        console.error(
          `[attachments] Upload failed for ${validated.filename}:`,
          err,
        );
        errors.push({
          filename: validated.filename,
          reason: "Upload to storage failed",
        });
        continue;
      }

      // Extract document text inline if applicable
      let extractedText: string | null = null;
      let extractionStatus = "skipped";
      if (
        validated.kind === "document" &&
        buffer.length <= INLINE_EXTRACTION_MAX_BYTES
      ) {
        const extraction = await extractDocumentText(
          buffer,
          validated.mimeType,
          validated.filename,
        );
        extractedText = extraction.text || null;
        extractionStatus = extraction.status;
      }

      // Create a temporary message record to hold the attachment (seq 0, empty content)
      // The actual message with content is created when the user sends their message
      // For now, we store the attachment with the conversation context only
      results.push({
        id: attachmentId,
        filename: validated.filename,
        mimeType: validated.mimeType,
        bytes: validated.bytes,
        kind: validated.kind,
        extractionStatus,
      });

      // Store extraction info for later use when the message is created
      // We return the extracted text to the client so it can be sent with the message
      (results[results.length - 1] as any).extractedText = extractedText;
      (results[results.length - 1] as any).storageKey = storageKey;
    }

    return NextResponse.json({
      attachments: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Attachment upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
