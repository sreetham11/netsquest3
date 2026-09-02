-- Spin to Decide.
--
-- ADDITIVE ONLY. This database is shared with another codebase that has
-- applied migrations not present in this repo (PointLot, Account.autoTopup*,
-- Transaction.refundedAt, RewardTier.multiplierPercent,
-- SplitParticipant.userId). Nothing here drops or alters an existing object,
-- so those remain untouched. Every added column is nullable or defaulted, so
-- existing rows stay valid.

-- Optional shared extra + the two spin results (both reference
-- SplitParticipant.id; integrity enforced in the Server Action).
ALTER TABLE "Split"
  ADD COLUMN "extraLabel" TEXT,
  ADD COLUMN "extraAmountCents" INTEGER,
  ADD COLUMN "payerParticipantId" TEXT,
  ADD COLUMN "extraOwnerParticipantId" TEXT,
  ADD COLUMN "spunAt" TIMESTAMP(3);

-- isCreator: participants are name-only, so this marks which row is "you".
-- extraOptIn: THREE-STATE. NULL = not yet responded and blocks the spin;
-- silence must never coerce to true/false.
ALTER TABLE "SplitParticipant"
  ADD COLUMN "isCreator" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "extraOptIn" BOOLEAN;
