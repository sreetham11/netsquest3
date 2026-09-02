-- Declares Account.autoTopup{Enabled,ThresholdCents,AmountCents} in this
-- branch's migration history.
--
-- These columns ALREADY EXIST in the live (shared) database — added by
-- another codebase/branch's migration against this same Supabase project
-- (confirmed via information_schema before writing this). This branch's
-- schema.prisma just never declared them. IF NOT EXISTS makes this
-- idempotent/safe to apply here without touching anything the other
-- codebase owns.

ALTER TABLE "Account"
  ADD COLUMN IF NOT EXISTS "autoTopupEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "autoTopupThresholdCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "autoTopupAmountCents" INTEGER;
