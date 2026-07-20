import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/db";
import { deleteConversationAttachments } from "@/lib/chatStorage";

export const dynamic = "force-dynamic";

/**
 * GET /api/chat/conversations/[id] — get a conversation with all messages and attachments
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const conversation = await prisma.chatConversation.findFirst({
      where: { id, userId: user.id },
      include: {
        messages: {
          orderBy: { seq: "asc" },
          include: { attachments: true },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Chat conversation get error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/chat/conversations/[id] — rename or archive/unarchive
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Verify ownership
    const existing = await prisma.chatConversation.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    const data: Record<string, unknown> = {};
    if (typeof body?.title === "string" && body.title.trim()) {
      data.title = body.title.trim().slice(0, 200);
    }
    if (typeof body?.isArchived === "boolean") {
      data.isArchived = body.isArchived;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const updated = await prisma.chatConversation.update({
      where: { id },
      data,
    });

    return NextResponse.json({ conversation: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Chat conversation update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/chat/conversations/[id] — delete a conversation and all its data
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Verify ownership
    const conversation = await prisma.chatConversation.findFirst({
      where: { id, userId: user.id },
    });
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    // Delete S3 objects for this conversation
    try {
      await deleteConversationAttachments(user.id, id);
    } catch (err) {
      console.error(`Failed to clean S3 for conversation ${id}:`, err);
    }

    // Cascade delete from PostgreSQL (messages + attachments cascade)
    await prisma.chatConversation.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Chat conversation delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
