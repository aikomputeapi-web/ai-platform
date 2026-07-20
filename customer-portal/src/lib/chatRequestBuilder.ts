/**
 * Provider-neutral request assembly for chat completions.
 *
 * Builds an OpenAI-compatible messages array from persisted conversation
 * history. Images are included as base64 data URLs only when the selected
 * model supports vision. Document context is injected as bounded text blocks
 * with clear source boundaries.
 */

import type { ChatMessage, ChatAttachment } from "@prisma/client";
import { downloadAttachment } from "@/lib/chatStorage";
import { buildDocumentContextBlock } from "@/lib/chatExtraction";

interface ModelCapability {
  vision: boolean;
  contextLength?: number;
}

interface AssembledRequest {
  messages: Array<{
    role: string;
    content: string | Array<Record<string, unknown>>;
  }>;
  model: string;
  stream: boolean;
}

const MAX_HISTORY_MESSAGES = 50;
const MAX_IMAGE_COUNT = 4;

/**
 * Assemble the OpenAI-compatible chat completion request from conversation
 * history. Only completed (non-streaming, non-failed) messages are included.
 */
export async function assembleChatRequest(
  history: ChatMessage[],
  selectedModel: string,
  modelCapability: ModelCapability,
  attachments: ChatAttachment[],
): Promise<AssembledRequest> {
  // Build a map of attachments by message ID for quick lookup
  const attachmentsByMessage = new Map<string, ChatAttachment[]>();
  for (const att of attachments) {
    const list = attachmentsByMessage.get(att.messageId) || [];
    list.push(att);
    attachmentsByMessage.set(att.messageId, list);
  }

  // Take the most recent N messages, in chronological order
  const recent = history
    .filter((m) => m.status === "complete" || m.role === "user")
    .slice(-MAX_HISTORY_MESSAGES);

  const messages: AssembledRequest["messages"] = [];

  for (const msg of recent) {
    const msgAttachments = attachmentsByMessage.get(msg.id) || [];

    if (msg.role === "user" && msgAttachments.length > 0) {
      // Build multimodal content for user messages with attachments
      const contentParts: Array<Record<string, unknown>> = [];

      // Add text content first (if any)
      if (msg.content.trim()) {
        contentParts.push({ type: "text", text: msg.content });
      }

      // Add images only if the model supports vision
      let imageCount = 0;
      for (const att of msgAttachments) {
        if (
          att.kind === "image" &&
          modelCapability.vision &&
          imageCount < MAX_IMAGE_COUNT
        ) {
          try {
            const buffer = await downloadAttachment(att.storageKey);
            const dataUrl = `data:${att.mimeType};base64,${buffer.toString("base64")}`;
            contentParts.push({
              type: "image_url",
              image_url: { url: dataUrl },
            });
            imageCount++;
          } catch (err) {
            console.error(
              `[request-builder] Failed to load image ${att.id}:`,
              err,
            );
          }
        } else if (att.kind === "document" && att.extractedText) {
          // Inject document context as text
          const docBlock = buildDocumentContextBlock(
            att.filename,
            att.extractedText,
          );
          if (docBlock) {
            contentParts.push({ type: "text", text: docBlock });
          }
        }
      }

      if (contentParts.length === 1 && contentParts[0].type === "text") {
        // Single text part — simplify to string
        messages.push({
          role: msg.role,
          content: contentParts[0].text as string,
        });
      } else if (contentParts.length > 0) {
        messages.push({ role: msg.role, content: contentParts });
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
    } else {
      // Plain text message (system, assistant, or user without attachments)
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  return {
    messages,
    model: selectedModel,
    stream: true,
  };
}
