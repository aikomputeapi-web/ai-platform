import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  ensureChatCredential,
  getDecryptedChatApiKey,
} from "@/lib/chatCredential";
import { assembleChatRequest } from "@/lib/chatRequestBuilder";
import { getAvailableModels } from "@/lib/omniroute";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for streaming

const OMNIROUTE_URL =
  process.env.OMNIROUTE_INTERNAL_URL || "http://127.0.0.1:20128";

/**
 * POST /api/chat/send — send a message and stream the assistant response.
 *
 * Request body:
 *   conversationId: string
 *   content: string (user message text)
 *   model: string (selected model ID)
 *   attachments?: Array<{ id, filename, mimeType, bytes, kind, storageKey, extractedText }>
 *
 * Response: Server-Sent Events stream with normalized events:
 *   data: {"type":"start","messageId":"..."}
 *   data: {"type":"text-delta","text":"..."}
 *   data: {"type":"usage","promptTokens":123,"completionTokens":456}
 *   data: {"type":"finish","messageId":"...","content":"..."}
 *   data: {"type":"error","message":"..."}
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    const { conversationId, content, model, attachments } = body;

    // Validate required fields
    if (!conversationId || typeof conversationId !== "string") {
      return Response.json(
        { error: "conversationId is required" },
        { status: 400 },
      );
    }
    if (!model || typeof model !== "string") {
      return Response.json({ error: "model is required" }, { status: 400 });
    }
    if (typeof content !== "string") {
      return Response.json(
        { error: "content must be a string" },
        { status: 400 },
      );
    }

    // Verify conversation ownership
    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, userId: user.id },
    });
    if (!conversation) {
      return Response.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    // Ensure hidden chat credential exists
    const userWithPlan = await prisma.user.findUnique({
      where: { id: user.id },
      include: { plan: true },
    });
    if (!userWithPlan) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    await ensureChatCredential(userWithPlan as any);
    const apiKey = await getDecryptedChatApiKey(user.id);

    // Get model capabilities (for vision detection)
    const rawModels = await getAvailableModels();
    const modelInfo = rawModels.find(
      (m: Record<string, unknown>) => m.id === model,
    );
    const capabilities = modelInfo?.capabilities as
      Record<string, boolean> | undefined;
    const inputModalities = modelInfo?.input_modalities as string[] | undefined;
    const modelCapability = {
      vision:
        capabilities?.vision === true ||
        (Array.isArray(inputModalities) && inputModalities.includes("image")),
      contextLength: modelInfo?.context_length as number | undefined,
    };

    // Get conversation history
    const history = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { seq: "asc" },
      include: { attachments: true },
    });

    // Determine next sequence number
    const nextSeq =
      history.length > 0 ? Math.max(...history.map((m) => m.seq)) + 1 : 0;

    // Persist the user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        conversationId,
        userId: user.id,
        role: "user",
        content,
        status: "complete",
        seq: nextSeq,
      },
    });

    // Create attachment records for the user message
    const allAttachments: Array<{
      id: string;
      kind: string;
      filename: string;
      mimeType: string;
      storageKey: string;
      extractedText: string | null;
    }> = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        const attachment = await prisma.chatAttachment.create({
          data: {
            messageId: userMessage.id,
            userId: user.id,
            filename: att.filename,
            mimeType: att.mimeType,
            bytes: att.bytes,
            storageKey: att.storageKey,
            kind: att.kind,
            extractedText: att.extractedText || null,
            extractionStatus: att.extractedText ? "extracted" : "skipped",
          },
        });
        allAttachments.push({
          id: attachment.id,
          kind: attachment.kind,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          storageKey: attachment.storageKey,
          extractedText: attachment.extractedText,
        });
      }
    }

    // Assemble the request to OmniRoute
    const allHistoryAttachments = await prisma.chatAttachment.findMany({
      where: { messageId: { in: history.map((m) => m.id) } },
    });
    const assembled = await assembleChatRequest(
      [...history, userMessage],
      model,
      modelCapability,
      allHistoryAttachments,
    );

    // Create the assistant message in streaming state
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        conversationId,
        userId: user.id,
        role: "assistant",
        content: "",
        status: "streaming",
        selectedModel: model,
        seq: nextSeq + 1,
      },
    });

    // Update conversation title if this is the first message
    if (history.length === 0 && conversation.title === "New Conversation") {
      const title = content.slice(0, 60).trim() || "New Conversation";
      await prisma.chatConversation.update({
        where: { id: conversationId },
        data: { title },
      });
    }

    // Build the SSE response stream
    const encoder = new TextEncoder();
    let accumulatedText = "";
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;
    let totalTokens: number | null = null;
    let routedModel: string | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        };

        sendEvent({ type: "start", messageId: assistantMessage.id });

        try {
          // Forward to OmniRoute with the user's hidden API key
          const omniResponse = await fetch(
            `${OMNIROUTE_URL}/v1/chat/completions`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({ ...assembled, stream: true }),
              signal: req.signal,
            },
          );

          if (!omniResponse.ok) {
            const errorText = await omniResponse
              .text()
              .catch(() => "Unknown error");
            throw new Error(
              `OmniRoute error (${omniResponse.status}): ${errorText}`,
            );
          }

          if (!omniResponse.body) {
            throw new Error("No response body from OmniRoute");
          }

          // Parse the SSE stream from OmniRoute
          const reader = omniResponse.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const chunk = JSON.parse(data);
                const delta = chunk.choices?.[0]?.delta;

                if (delta?.content) {
                  accumulatedText += delta.content;
                  sendEvent({ type: "text-delta", text: delta.content });
                }

                if (chunk.usage) {
                  promptTokens = chunk.usage.prompt_tokens ?? null;
                  completionTokens = chunk.usage.completion_tokens ?? null;
                  totalTokens = chunk.usage.total_tokens ?? null;
                }

                if (chunk.model && !routedModel) {
                  routedModel = chunk.model;
                }

                // Check for finish reason
                const finishReason = chunk.choices?.[0]?.finish_reason;
                if (finishReason) {
                  // Stream is complete
                }
              } catch {
                // Skip unparseable chunks
              }
            }
          }

          // Finalize the assistant message
          await prisma.chatMessage.update({
            where: { id: assistantMessage.id },
            data: {
              content: accumulatedText,
              status: "complete",
              routedModel,
              routedProvider: routedModel ? inferProvider(routedModel) : null,
              promptTokens,
              completionTokens,
              totalTokens,
            },
          });

          // Update conversation updatedAt
          await prisma.chatConversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          });

          sendEvent({
            type: "finish",
            messageId: assistantMessage.id,
            content: accumulatedText,
            usage: { promptTokens, completionTokens, totalTokens },
            routedModel,
          });
        } catch (err) {
          // Mark as interrupted or failed, preserving partial output
          const isAborted = err instanceof Error && err.name === "AbortError";
          await prisma.chatMessage.update({
            where: { id: assistantMessage.id },
            data: {
              content: accumulatedText,
              status: isAborted ? "interrupted" : "failed",
              errorMessage: isAborted
                ? null
                : err instanceof Error
                  ? err.message
                  : "Unknown error",
            },
          });

          if (isAborted) {
            sendEvent({
              type: "finish",
              messageId: assistantMessage.id,
              content: accumulatedText,
              interrupted: true,
            });
          } else {
            sendEvent({
              type: "error",
              message: err instanceof Error ? err.message : "Unknown error",
            });
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Chat send error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

function inferProvider(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower.includes("gpt") || lower.includes("o3") || lower.includes("o4"))
    return "openai";
  if (lower.includes("claude")) return "anthropic";
  if (lower.includes("gemini")) return "google";
  if (lower.includes("grok")) return "xai";
  if (lower.includes("deepseek")) return "deepseek";
  if (lower.includes("llama")) return "meta";
  if (lower.includes("mistral")) return "mistral";
  return "unknown";
}
