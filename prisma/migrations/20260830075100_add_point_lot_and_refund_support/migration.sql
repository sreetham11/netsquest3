-- AlterEnum
ALTER TYPE "TxnType" ADD VALUE 'REFUND';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RewardTier" ADD COLUMN     "multiplierPercent" INTEGER NOT NULL DEFAULT 100;

-- CreateTable
CREATE TABLE "PointLot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "pointsEarned" INTEGER NOT NULL,
    "pointsRemaining" INTEGER NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PointLot_transactionId_key" ON "PointLot"("transactionId");

-- CreateIndex
CREATE INDEX "PointLot_userId_earnedAt_idx" ON "PointLot"("userId", "earnedAt");

-- CreateIndex
CREATE INDEX "PointLot_userId_expiresAt_idx" ON "PointLot"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "PointLot" ADD CONSTRAINT "PointLot_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
