import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";

// The delegates this touches — typed structurally so it accepts both `prisma`
// and a `tx` client from an interactive prisma.$transaction, same convention
// as recordNetsPayment's NetsPaymentClient.
type AutoTopupClient = Pick<PrismaClient, "account" | "transaction">;

// Called after every balance-decreasing write, on the SAME transaction client
// that just applied the decrement, so the whole thing (spend + auto-topup)
// commits or rolls back together. In practice there is exactly one real
// balance-decrementing call site in this app — recordNetsPayment — so this is
// invoked from there; split settlement has no balance effect at all
// (confirmed: it's name-only, no linked accounts, per createSplit's own
// comment), so there's nothing else to wire this into today.
//
// Double-fire / infinite-loop safety: the conditional `updateMany` below only
// applies if balanceCents is STILL below the threshold at write time (re-
// checked, not assumed from an earlier read) AND auto-topup is still enabled.
// Once it succeeds, balanceCents becomes >= topupAmountCents, and
// saveAutoTopupSettings requires topupAmountCents > thresholdCents, so the
// post-topup balance is always > threshold — the condition that would
// re-trigger it is no longer true. Two balance-decreasing writes racing in
// the same instant can't both pass this guard: only the one that wins the
// row lock with balanceCents still under threshold gets `count > 0`.
export async function triggerAutoTopupIfNeeded(client: AutoTopupClient, userId: string): Promise<void> {
  const account = await client.account.findUnique({ where: { userId } });
  if (!account?.autoTopupEnabled) return;
  const { autoTopupThresholdCents: threshold, autoTopupAmountCents: amount } = account;
  if (threshold == null || amount == null) return;
  if (account.balanceCents >= threshold) return;

  const claimed = await client.account.updateMany({
    where: { userId, autoTopupEnabled: true, balanceCents: { lt: threshold } },
    data: { balanceCents: { increment: amount } },
  });
  if (claimed.count === 0) return;

  await client.transaction.create({
    data: {
      userId,
      description: "Auto Top-up",
      category: "Top-up",
      amountCents: amount,
      type: "TOPUP",
    },
  });
}
