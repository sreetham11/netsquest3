-- Savings Goals — a brand new table, no interaction with any existing or
-- shared schema (unlike the Contact/Account.autoTopup migrations, nothing
-- here touches a table another codebase owns). IF NOT EXISTS kept for
-- consistency with this branch's other migrations and safety on reapply.

CREATE TABLE IF NOT EXISTS "SavingsGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmountCents" INTEGER NOT NULL,
    "currentSavedCents" INTEGER NOT NULL DEFAULT 0,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiCostEstimate" TEXT,
    "aiSuggestions" TEXT,
    "aiSuggestionsAt" TIMESTAMP(3),

    CONSTRAINT "SavingsGoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SavingsGoal_userId_idx" ON "SavingsGoal"("userId");
