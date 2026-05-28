-- Seed Pro, Max 5x, and Max 20x plans for subscription tier management
-- This migration is safe to re-run in dev environments because it upserts by primary key.

INSERT INTO "plans" (
  "id",
  "name",
  "price_cents",
  "requests_per_day",
  "requests_per_minute",
  "requests_per_month",
  "allowed_models",
  "stripe_price_id"
)
VALUES
  ('pro', 'Pro', 500, 3000, 60, 300000, '*', NULL),
  ('max-5x', 'Max 5x', 2500, 6000, 150, 600000, '*', NULL),
  ('max-20x', 'Max 20x', 5000, 12000, 300, 1200000, '*', NULL)
ON CONFLICT ("id") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "price_cents" = EXCLUDED."price_cents",
  "requests_per_day" = EXCLUDED."requests_per_day",
  "requests_per_minute" = EXCLUDED."requests_per_minute",
  "requests_per_month" = EXCLUDED."requests_per_month",
  "allowed_models" = EXCLUDED."allowed_models",
  "stripe_price_id" = EXCLUDED."stripe_price_id";
