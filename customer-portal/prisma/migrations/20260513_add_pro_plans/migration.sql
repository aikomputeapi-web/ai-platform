-- Seed Pro, Max 5x, and Max 20x plans for subscription tier management
-- This migration is safe to re-run in dev environments because it upserts by primary key.

INSERT INTO "plans" (
  "id",
  "name",
  "price_cents",
  "requests_per_day",
  "requests_per_minute",
  "requests_per_month",
  "limit_5h_tokens",
  "limit_week_tokens",
  "limit_month_tokens",
  "allowed_models",
  "stripe_price_id"
)
VALUES
  ('pro', 'Pro', 2000, 0, 0, 0, 2000000, 8000000, 25000000, '*', NULL),
  ('max-5x', 'Max 5x', 10000, 0, 0, 0, 10000000, 40000000, 125000000, '*', NULL),
  ('max-20x', 'Max 20x', 20000, 0, 0, 0, 40000000, 160000000, 500000000, '*', NULL)
ON CONFLICT ("id") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "price_cents" = EXCLUDED."price_cents",
  "requests_per_day" = EXCLUDED."requests_per_day",
  "requests_per_minute" = EXCLUDED."requests_per_minute",
  "requests_per_month" = EXCLUDED."requests_per_month",
  "limit_5h_tokens" = EXCLUDED."limit_5h_tokens",
  "limit_week_tokens" = EXCLUDED."limit_week_tokens",
  "limit_month_tokens" = EXCLUDED."limit_month_tokens",
  "allowed_models" = EXCLUDED."allowed_models",
  "stripe_price_id" = EXCLUDED."stripe_price_id";
