-- AlterTable: Add shadow lock and shadow ban fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_shadow_locked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_shadow_banned" BOOLEAN NOT NULL DEFAULT false;
