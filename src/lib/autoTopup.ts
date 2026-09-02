import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Accepts either the top-level `prisma` client or a `tx` client from inside
// an interactive prisma.$transaction — same call site works both ways, but
// every real call site passes the `tx` from the SAME transaction that just
// applied the balance-decreasing write, so the spend and the auto-topup
// commit or roll back together (genuinely atomic, not "happens right after").
type AutoTopupClient = typeof prisma | Prisma.TransactionClient;

// Called after every balance-decreasing write (currently: payBill,
// makePayment — Split has no balance effect at all, see createSplit's own
// comment, so there's nothing else to wire this into).
//
// Double-fire / infinite-loop safety: the conditional `updateMany` only
// applies if balanceCents is STILL below the threshold at write time
// (re-checked, not assumed from the read above) AND auto-topup is still
// enabled. Once it succeeds, balanceCents becomes >= autoTopupAmountCents,
// and saveAutoTopupSettings requires amount > threshold, so the post-topup
// balance is always > threshold — the condition that would re-trigger it is
// no longer true. Two balance-decreasing writes racing in the same instant
// can't both pass this guard: only the one whose updateMany still sees
// balanceCents under threshold gets `count > 0`.
export async function triggerAutoTopupIfNeeded(
  client: AutoTopupClient,
  userId: string,
): Promise<void> {
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
