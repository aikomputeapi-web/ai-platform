-- Chat feature: conversations, messages, attachments, and hidden credentials

CREATE TABLE IF NOT EXISTS "chat_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_conversations_user_id_is_archived_updated_at_idx"
    ON "chat_conversations"("user_id", "is_archived", "updated_at");

ALTER TABLE "chat_conversations"
    ADD CONSTRAINT "chat_conversations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'complete',
    "selected_model" TEXT,
    "routed_provider" TEXT,
    "routed_model" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "error_message" TEXT,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_messages_conversation_id_seq_idx"
    ON "chat_messages"("conversation_id", "seq");

CREATE INDEX IF NOT EXISTS "chat_messages_user_id_created_at_idx"
    ON "chat_messages"("user_id", "created_at");

ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "chat_attachments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "extracted_text" TEXT,
    "extraction_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_attachments_message_id_idx"
    ON "chat_attachments"("message_id");

CREATE INDEX IF NOT EXISTS "chat_attachments_user_id_idx"
    ON "chat_attachments"("user_id");

ALTER TABLE "chat_attachments"
    ADD CONSTRAINT "chat_attachments_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_attachments"
    ADD CONSTRAINT "chat_attachments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "chat_credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "omniroute_key_id" TEXT NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_credentials_user_id_key"
    ON "chat_credentials"("user_id");

ALTER TABLE "chat_credentials"
    ADD CONSTRAINT "chat_credentials_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
