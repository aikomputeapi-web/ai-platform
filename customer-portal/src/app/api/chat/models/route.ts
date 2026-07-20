import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAvailableModels } from "@/lib/omniroute";

export const dynamic = "force-dynamic";

/**
 * GET /api/chat/models — list text-generation models available to the user.
 *
 * Reads OmniRoute's /api/v1/models, filters to text-generation models only
 * (the OmniRoute catalog policy already enforces this), and enriches each
 * entry with provider family and vision capability metadata for the UI.
 */
export async function GET() {
  try {
    const user = await requireAuth();

    // Check plan model restrictions
    const allowedModels = user.plan?.allowedModels;
    const isAllModels = !allowedModels || allowedModels === "*";
    const allowedSet = isAllModels
      ? null
      : new Set(JSON.parse(allowedModels) as string[]);

    const rawModels = await getAvailableModels();

    const models = rawModels
      .filter((model: Record<string, unknown>) => {
        // The OmniRoute catalog already filters to text-generation, but double-check
        const type = model.type;
        if (typeof type === "string" && type !== "chat" && type !== undefined)
          return false;
        return true;
      })
      .map((model: Record<string, unknown>) => {
        const id = model.id as string;
        const capabilities = model.capabilities as
          Record<string, boolean> | undefined;
        const inputModalities = model.input_modalities as string[] | undefined;

        return {
          id,
          contextLength: model.context_length as number | undefined,
          maxOutputTokens: model.max_output_tokens as number | undefined,
          vision:
            capabilities?.vision === true ||
            (inputModalities?.includes("image") ?? false),
          toolCalling: capabilities?.tool_calling === true,
          reasoning: capabilities?.reasoning === true,
          providerFamily: inferProviderFamily(id),
        };
      })
      .filter((model: { id: string }) => {
        if (!allowedSet) return true;
        return allowedSet.has(model.id);
      });

    return NextResponse.json({ models });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Chat models list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function inferProviderFamily(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower.includes("gpt") || lower.includes("o3") || lower.includes("o4"))
    return "openai";
  if (lower.includes("claude") || lower.includes("anthropic"))
    return "anthropic";
  if (lower.includes("gemini") || lower.includes("gemma")) return "google";
  if (lower.includes("grok")) return "xai";
  if (lower.includes("deepseek")) return "deepseek";
  if (lower.includes("llama")) return "meta";
  if (lower.includes("mistral") || lower.includes("devstral")) return "mistral";
  if (lower.includes("qwen")) return "alibaba";
  if (lower.includes("kimi")) return "moonshot";
  if (lower.includes("glm")) return "zhipu";
  if (lower.includes("minimax")) return "minimax";
  return "other";
}
