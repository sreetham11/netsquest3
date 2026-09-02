-- Saved contacts for Split.
--
-- Scope: ADDITIVE ONLY. This database is shared with another codebase, which
-- owns rows/columns absent from our schema.prisma (PointLot, Account.autoTopup*,
-- SplitParticipant.userId). Nothing here drops or alters any of those — apply
-- with `prisma migrate deploy`, never `migrate dev` (drift detection would
-- offer to delete them).
--
-- Contact.phoneNumber is cosmetic display data only: no messaging, invites, or
-- notification logic is tied to it, and it is never used to look up a real user.

CREATE TABLE IF NOT EXISTS "Contact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Contact_userId_idx" ON "Contact"("userId");

-- A participant is either a saved contact (contactId set) or a one-off
-- freeform name (contactId NULL). `name` stays populated in both cases.
ALTER TABLE "SplitParticipant" ADD COLUMN IF NOT EXISTS "contactId" TEXT;

CREATE INDEX IF NOT EXISTS "SplitParticipant_contactId_idx" ON "SplitParticipant"("contactId");

-- SET NULL, not CASCADE: deleting a contact must leave past splits intact,
-- falling back to the name frozen on the participant row.
ALTER TABLE "SplitParticipant"
  DROP CONSTRAINT IF EXISTS "SplitParticipant_contactId_fkey";
ALTER TABLE "SplitParticipant"
  ADD CONSTRAINT "SplitParticipant_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
