-- Replace the cashback-tier system with points + redemption.
-- RewardTier is repurposed to key off monthly NETS-payment COUNT instead of a
-- point threshold. Existing rows are old cashback-tier demo data with no valid
-- mapping to a transaction count, so they're cleared; every user gets fresh
-- tiers again via ensureUserData on next signup (demo data, safe to reset).
TRUNCATE TABLE "RewardTier";

ALTER TABLE "RewardTier" DROP COLUMN "pointsNeeded";
ALTER TABLE "RewardTier" ADD COLUMN "txnCountNeeded" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pointCost" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reward_name_key" ON "Reward"("name");

-- CreateIndex
CREATE INDEX "Redemption_userId_createdAt_idx" ON "Redemption"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
