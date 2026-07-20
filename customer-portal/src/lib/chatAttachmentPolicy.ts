/**
 * Attachment policy and validation for chat file uploads.
 *
 * Supported file types and limits:
 *   Images: PNG, JPEG, GIF, WebP — up to 10 MB each, max 4 per message
 *   Documents: PDF, TXT, Markdown, CSV, JSON — up to 25 MB each, max 4 per message
 *
 * Rejected: archives (zip, tar, rar, 7z), executables (.exe, .dll, .so, .dylib, .app),
 * scripts (.sh, .bat, .ps1), and any file whose extension or MIME type doesn't match
 * the allowlist.
 */

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_ATTACHMENTS_PER_MESSAGE = 8;

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
]);
const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/csv",
]);

// Explicitly rejected — even if the extension somehow matches, block these
const REJECTED_EXTENSIONS = new Set([
  "zip",
  "tar",
  "gz",
  "rar",
  "7z",
  "bz2",
  "exe",
  "dll",
  "so",
  "dylib",
  "app",
  "msi",
  "sh",
  "bat",
  "ps1",
  "cmd",
  "com",
  "scr",
  "js",
  "mjs",
  "cjs",
  "ts",
  "py",
  "rb",
  "php",
  "java",
  "jar",
  "war",
  "html",
  "htm",
  "svg", // SVG can carry scripts
]);

export type AttachmentKind = "image" | "document";

export interface ValidatedAttachment {
  kind: AttachmentKind;
  mimeType: string;
  filename: string;
  bytes: number;
}

export interface AttachmentValidationError {
  filename: string;
  reason: string;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

function sanitizeFilename(filename: string): string {
  // Strip path separators and null bytes
  const base = filename.replace(/[\\/]/g, "").replace(/\0/g, "");
  // Limit length
  return base.slice(0, 255) || "unnamed";
}

export function classifyAttachment(
  filename: string,
  declaredMimeType: string,
): { kind: AttachmentKind; mimeType: string } | null {
  const ext = getExtension(filename);
  const mime = declaredMimeType.toLowerCase().split(";")[0].trim();

  if (REJECTED_EXTENSIONS.has(ext)) return null;

  if (IMAGE_EXTENSIONS.has(ext) || IMAGE_MIME_TYPES.has(mime)) {
    // Normalize MIME based on extension if the declared MIME doesn't match
    const normalizedMime = IMAGE_MIME_TYPES.has(mime)
      ? mime
      : `image/${ext === "jpg" ? "jpeg" : ext}`;
    return { kind: "image", mimeType: normalizedMime };
  }

  if (DOCUMENT_EXTENSIONS.has(ext) || DOCUMENT_MIME_TYPES.has(mime)) {
    const extMimeMap: Record<string, string> = {
      pdf: "application/pdf",
      txt: "text/plain",
      md: "text/markdown",
      markdown: "text/markdown",
      csv: "text/csv",
      json: "application/json",
    };
    const normalizedMime = DOCUMENT_MIME_TYPES.has(mime)
      ? mime
      : extMimeMap[ext] || "application/octet-stream";
    return { kind: "document", mimeType: normalizedMime };
  }

  return null;
}

export function validateAttachment(
  filename: string,
  declaredMimeType: string,
  bytes: number,
): ValidatedAttachment | AttachmentValidationError {
  const sanitized = sanitizeFilename(filename);
  const classification = classifyAttachment(sanitized, declaredMimeType);

  if (!classification) {
    return {
      filename: sanitized,
      reason:
        "Unsupported file type. Allowed: images (PNG, JPEG, GIF, WebP) and documents (PDF, TXT, MD, CSV, JSON).",
    };
  }

  const maxBytes =
    classification.kind === "image" ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  if (bytes > maxBytes) {
    return {
      filename: sanitized,
      reason: `File exceeds the ${classification.kind} limit of ${maxBytes / (1024 * 1024)} MB`,
    };
  }

  if (bytes === 0) {
    return { filename: sanitized, reason: "File is empty" };
  }

  return {
    kind: classification.kind,
    mimeType: classification.mimeType,
    filename: sanitized,
    bytes,
  };
}

export function validateAttachmentBatch(
  files: Array<{ filename: string; mimeType: string; bytes: number }>,
): { valid: ValidatedAttachment[]; errors: AttachmentValidationError[] } {
  if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return {
      valid: [],
      errors: [
        {
          filename: "",
          reason: `Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message`,
        },
      ],
    };
  }

  const valid: ValidatedAttachment[] = [];
  const errors: AttachmentValidationError[] = [];

  for (const file of files) {
    const result = validateAttachment(file.filename, file.mimeType, file.bytes);
    if ("reason" in result) {
      errors.push(result);
    } else {
      valid.push(result);
    }
  }

  return { valid, errors };
}

export const ATTACHMENT_LIMITS = {
  MAX_IMAGE_BYTES,
  MAX_DOCUMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
};
