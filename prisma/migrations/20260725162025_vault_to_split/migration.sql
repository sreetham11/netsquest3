-- Replace Vault (long-term pooled savings goal, real-user membership/invite)
-- with Split (instant bill splitting among named-only participants).

-- DropForeignKey
ALTER TABLE "VaultMembership" DROP CONSTRAINT "VaultMembership_vaultId_fkey";

-- DropTable
DROP TABLE "VaultMembership";

-- DropTable
DROP TABLE "Vault";

-- CreateTable
CREATE TABLE "Split" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "totalAmountCents" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Split_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitParticipant" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shareAmountCents" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SplitParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Split_ownerId_idx" ON "Split"("ownerId");

-- CreateIndex
CREATE INDEX "SplitParticipant_splitId_idx" ON "SplitParticipant"("splitId");

-- AddForeignKey
ALTER TABLE "SplitParticipant" ADD CONSTRAINT "SplitParticipant_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE CASCADE ON UPDATE CASCADE;
