-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "autoTopupAmountCents" INTEGER,
ADD COLUMN     "autoTopupEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoTopupThresholdCents" INTEGER;
