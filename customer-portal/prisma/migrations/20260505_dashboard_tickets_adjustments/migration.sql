CREATE TABLE IF NOT EXISTS "billing_adjustments" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'applied',
  "actor" text NOT NULL DEFAULT 'admin',
  "created_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "billing_adjustments_user_id_created_at_idx" ON "billing_adjustments" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "billing_adjustments_type_created_at_idx" ON "billing_adjustments" ("type", "created_at");

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" text PRIMARY KEY,
  "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "subject" text NOT NULL,
  "description" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "priority" text NOT NULL DEFAULT 'normal',
  "assigned_to" text,
  "source" text NOT NULL DEFAULT 'manual',
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "support_tickets_status_priority_created_at_idx" ON "support_tickets" ("status", "priority", "created_at");
CREATE INDEX IF NOT EXISTS "support_tickets_user_id_created_at_idx" ON "support_tickets" ("user_id", "created_at");

ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "internal_notes" text;

CREATE TABLE IF NOT EXISTS "scheduled_reports" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "report_type" text NOT NULL,
  "recipient_email" text NOT NULL,
  "cadence" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "filters" jsonb,
  "notes" text,
  "last_run_at" timestamptz,
  "next_run_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "scheduled_reports_enabled_next_run_at_idx" ON "scheduled_reports" ("enabled", "next_run_at");
CREATE INDEX IF NOT EXISTS "scheduled_reports_report_type_enabled_idx" ON "scheduled_reports" ("report_type", "enabled");

CREATE TABLE IF NOT EXISTS "admin_settings" (
  "key" text PRIMARY KEY,
  "value" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT NOW(),
  "created_at" timestamptz NOT NULL DEFAULT NOW()
);
