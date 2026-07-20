/**
 * Bounded document text extraction for chat attachments.
 *
 * Extracts text from supported document types (PDF, TXT, Markdown, CSV, JSON)
 * so it can be included as context in chat requests. The extracted text is
 * stored in PostgreSQL alongside the attachment metadata; the original binary
 * stays private in S3.
 *
 * Extraction is bounded: output is truncated to MAX_EXTRACTED_CHARS to prevent
 * oversized context injection. The truncation marker is appended so the model
 * knows the document was cut.
 */

const MAX_EXTRACTED_CHARS = 50000; // ~12.5k tokens — conservative per-document budget

export interface ExtractionResult {
  text: string;
  status: "extracted" | "failed" | "skipped";
}

export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<ExtractionResult> {
  try {
    let rawText: string;

    switch (mimeType) {
      case "application/pdf":
        rawText = await extractPdfText(buffer);
        break;

      case "text/plain":
      case "text/markdown":
      case "text/csv":
        rawText = buffer.toString("utf8");
        break;

      case "application/json":
      case "application/csv":
        rawText = buffer.toString("utf8");
        break;

      default:
        return { text: "", status: "skipped" };
    }

    // Normalize whitespace
    const cleaned = rawText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\t/g, "  ")
      .replace(/\u0000/g, "")
      .trim();

    if (cleaned.length === 0) {
      return { text: "", status: "skipped" };
    }

    if (cleaned.length > MAX_EXTRACTED_CHARS) {
      return {
        text:
          cleaned.slice(0, MAX_EXTRACTED_CHARS) +
          "\n\n[... document truncated ...]",
        status: "extracted",
      };
    }

    return { text: cleaned, status: "extracted" };
  } catch (err) {
    console.error(`[extraction] Failed to extract text from ${filename}:`, err);
    return { text: "", status: "failed" };
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Dynamic import so pdf-parse is only loaded when a PDF is actually processed
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
  const data = await pdfParse(buffer);
  return data.text || "";
}

/**
 * Build a bounded context block for a document attachment.
 * The source boundary is explicit so the model can distinguish document content
 * from user-authored text.
 */
export function buildDocumentContextBlock(
  filename: string,
  extractedText: string,
): string {
  if (!extractedText) return "";
  return `[Document: ${filename}]\n\n${extractedText}\n\n[End of document: ${filename}]`;
}
