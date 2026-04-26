-- Add per-month request caps (Free = 50/mo total)

ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "requests_per_month" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing plans
UPDATE "plans" SET "requests_per_month" = 50 WHERE "id" = 'free';
