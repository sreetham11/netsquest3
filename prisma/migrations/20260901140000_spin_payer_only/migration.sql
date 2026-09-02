-- Spin to Decide: drop the shared-extra sub-feature.
--
-- Scope: removes ONLY columns added by 20260901120000_spin_to_decide. Keeps
-- Split.payerParticipantId and Split.spunAt (payer-of-record is the whole
-- feature now). Touches nothing belonging to the other codebase that shares
-- this database (PointLot, Account.autoTopup*, Transaction.refundedAt,
-- RewardTier.multiplierPercent, SplitParticipant.userId).
--
-- "Owes payer" stays DERIVED from the existing shareAmountCents, so no
-- SplitParticipant columns are needed at all.

ALTER TABLE "Split"
  DROP COLUMN IF EXISTS "extraLabel",
  DROP COLUMN IF EXISTS "extraAmountCents",
  DROP COLUMN IF EXISTS "extraOwnerParticipantId";

ALTER TABLE "SplitParticipant"
  DROP COLUMN IF EXISTS "isCreator",
  DROP COLUMN IF EXISTS "extraOptIn";
