-- AlterTable
ALTER TABLE "users" ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "admin_note" TEXT;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'admin',
    "target_user_id" TEXT,
    "target_user_email" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");
CREATE INDEX "audit_logs_target_user_id_created_at_idx" ON "audit_logs"("target_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
