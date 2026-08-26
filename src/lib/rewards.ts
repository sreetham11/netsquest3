import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
// Re-exported so existing server-side imports of these from "@/lib/rewards"
// keep working unchanged — see netsPaymentTypes.ts for why they moved.
import { NETS_PAYMENT_TYPES, isNetsPaymentType, type NetsPaymentType } from "@/lib/netsPaymentTypes";
export { NETS_PAYMENT_TYPES, isNetsPaymentType, type NetsPaymentType };

// NETS Quest rewards philosophy — this is the actual design pitch, not just a
// mechanic: build a payment-method HABIT, not higher spend.
//   Pay with NETS -> Earn Points -> See Progress -> Redeem Reward -> Choose NETS again
//
// Three behavioral principles drive every decision in this file:
//   1. Visible progress   — always expose exact distance to the next reward;
//                            a concrete number motivates more than an abstract balance.
//   2. Tangible > abstract — a free coffee feels more memorable than an equivalent
//                            cashback %, even at identical dollar value.
//   3. Consistency > volume — tiers key off monthly transaction COUNT, not spend,
//                            because the goal is payment-method preference.

export const POINTS_PER_DOLLAR = 5;

// Points earned on a spend transaction: S$1 = 5 points, auto-credited with no
// separate activation step.
export function pointsForSpendCents(amountCents: number): number {
  // Garbage in earns nothing rather than writing NaN into an Int column.
  if (!Number.isFinite(amountCents)) return 0;
  // Multiply before dividing so the intermediate stays an integer. Going via
  // dollars first (cents / 100 * 5) turns exact cents into a binary fraction
  // for no reason, and money never leaves integer cents anywhere else here.
  // Math.abs keeps this non-negative regardless of the caller's sign
  // convention — points are never clawed back.
  return Math.round((Math.abs(Math.trunc(amountCents)) * POINTS_PER_DOLLAR) / 100);
}

// The delegates recordNetsPayment touches. Typed structurally so it accepts
// both `prisma` and the `tx` client from an interactive prisma.$transaction,
// letting callers fold the earn into a larger atomic write.
type NetsPaymentClient = Pick<PrismaClient, "account" | "transaction">;

// The ONE way to write a NETS payment. Debit, ledger row and point award are
// issued together on the caller's client, so there is no code path that can
// record a NETS payment and quietly forget the points. That failure is
// invisible and permanent — nothing re-derives Account.rewardPoints from the
// ledger afterwards — so it's worth making unrepresentable rather than
// re-checked. Callers MUST pass a $transaction client so a partial write
// (money moved, points not credited) can't survive a crash.
//
// Returns the ledger row's id alongside the points earned — payBill ignores
// it (discards the return value entirely, so this is non-breaking for it);
// makePayment needs it to send the user to /pay/success/[id].
export async function recordNetsPayment(
  client: NetsPaymentClient,
  payment: {
    userId: string;
    description: string;
    category: string;
    amountCents: number; // positive cents to charge; the debit sign is applied here
    type: NetsPaymentType;
  },
): Promise<{ transactionId: string; points: number }> {
  const points = pointsForSpendCents(payment.amountCents);

  await client.account.update({
    where: { userId: payment.userId },
    data: {
      balanceCents: { decrement: payment.amountCents },
      rewardPoints: { increment: points },
    },
  });

  const row = await client.transaction.create({
    data: {
      userId: payment.userId,
      description: payment.description,
      category: payment.category,
      amountCents: -payment.amountCents,
      type: payment.type,
    },
  });

  return { transactionId: row.id, points };
}

export type TierLike = { name: string; txnCountNeeded: number };

// Tier state for a given monthly NETS-payment count, recomputed from scratch on
// every render — no tier is ever stored on the account, so it can't go stale
// when the calendar month rolls over and the count resets to 0.
//
// Ordering is derived from txnCountNeeded rather than trusting the stored
// sortOrder: the threshold is what the UI compares against, so a mis-seeded
// sortOrder would otherwise hand back a "current" tier the user hasn't reached.
export function resolveTierProgress<T extends TierLike>(
  tiers: readonly T[],
  monthlyPaymentCount: number,
) {
  const ordered = [...tiers].sort((a, b) => a.txnCountNeeded - b.txnCountNeeded);

  // Highest tier whose threshold is met. A user with zero payments this month
  // still lands on the entry tier (threshold 0) instead of undefined.
  let current: T | undefined;
  for (const tier of ordered) {
    if (monthlyPaymentCount >= tier.txnCountNeeded) current = tier;
  }

  const next = ordered.find((t) => t.txnCountNeeded > monthlyPaymentCount);
  const floor = current?.txnCountNeeded ?? 0;
  const span = next ? next.txnCountNeeded - floor : 0;

  return {
    ordered,
    current,
    next,
    // Top tier has nothing left to fill, so the bar reads full. `span > 0`
    // guards two tiers seeded at the same threshold (divide by zero).
    progress: next && span > 0 ? Math.min(1, (monthlyPaymentCount - floor) / span) : 1,
    // Distinguishes "topped out" from "no tiers configured" — both leave `next`
    // undefined, but only the first should be celebrated in the UI.
    atTopTier: ordered.length > 0 && next === undefined,
  };
}
