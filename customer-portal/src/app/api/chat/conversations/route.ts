import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import { deleteConversationAttachments } from "@/lib/chatStorage";

export const dynamic = "force-dynamic";

/**
 * GET /api/chat/conversations — list user's conversations (non-archived by default)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const archived = searchParams.get("archived") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const conversations = await prisma.chatConversation.findMany({
      where: { userId: user.id, isArchived: archived },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Chat conversations list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/chat/conversations — create a new conversation
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const title =
      typeof body?.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 200)
        : "New Conversation";

    const conversation = await prisma.chatConversation.create({
      data: { userId: user.id, title },
    });

    return NextResponse.json({ conversation });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Chat conversation create error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/chat/conversations — delete all conversations for the user (dangerous)
 * Only used for "clear all" — individual deletes go through [id] route.
 */
export async function DELETE() {
  try {
    const user = await requireAuth();

    // Get all conversation IDs for cleanup
    const conversations = await prisma.chatConversation.findMany({
      where: { userId: user.id },
      select: { id: true },
    });

    // Delete S3 objects for each conversation
    for (const conv of conversations) {
      try {
        await deleteConversationAttachments(user.id, conv.id);
      } catch (err) {
        console.error(`Failed to clean S3 for conversation ${conv.id}:`, err);
      }
    }

    // Cascade delete from PostgreSQL (messages + attachments cascade)
    await prisma.chatConversation.deleteMany({ where: { userId: user.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Chat conversation delete-all error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
