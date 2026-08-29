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
//
// Economics, chosen to survive scrutiny (a real card programme would never
// approve a 5% reward rate, which is what this app shipped with originally):
//   - Earn: S$1 spent = 1 point (before tier multiplier) = a 1% base rate.
//   - Redeem: 100 points = $1 of reward value, for BOTH the catalogue and
//     cashback — one honest rate everywhere, not a richer one for cashback.

// Branded name for the points, used consistently across Rewards, Payment
// Successful, and anywhere points are shown — the app already used this
// exact phrase ("+50 NETS Points") on the Payment Successful screen before
// this pass; this formalizes it as the one name everywhere else too.
export const PROGRAMME_NAME = "NETS Points";

export const POINTS_PER_DOLLAR = 1;

// 100 points = $1 of reward value — the catalogue's pointCost values and
// cashback both redeem at this exact rate. See cashbackCentsForPoints.
export const REWARD_POINTS_PER_DOLLAR = 100;

// Anti-abuse: a transaction under this earns 0 points and doesn't advance
// tier progress — stops tier-farming via many $0.10 payments.
export const MIN_QUALIFYING_CENTS = 200; // $2

// Anti-abuse: qualifying payments to the SAME merchant (by description) on
// the SAME calendar day, beyond this many, earn 0 points — stops farming via
// repeat micro-payments at one merchant. "Qualifying" already excludes
// sub-$2 payments, so this only ever gates real spend.
export const MAX_DAILY_MERCHANT_QUALIFYING = 3;

// Points expire this many months after being earned.
export const POINTS_EXPIRY_MONTHS = 12;

// Points earned on a spend transaction: S$1 = 1 point (a believable 1% base
// rate), before any tier multiplier — see applyTierMultiplier for that.
//
// Math.abs() here just normalizes the caller's sign convention
// (recordNetsPayment always passes a positive charge amount) into a
// magnitude — it is NOT a claim that points survive a reversal. Under this
// model a refund SHOULD claw back the points it originally earned; that's
// handled explicitly by refundTransaction() reading the paired PointLot
// (src/app/(app)/actions.ts), not by this function. This stays a pure
// function of "how much was spent" -> "base points", with no way to know —
// or need to know — a transaction's later history.
export function pointsForSpendCents(amountCents: number): number {
  if (!Number.isFinite(amountCents)) return 0;
  const abs = Math.abs(Math.trunc(amountCents));
  if (abs < MIN_QUALIFYING_CENTS) return 0;
  return Math.round((abs * POINTS_PER_DOLLAR) / 100);
}

// Applies a tier's earn-rate multiplier (hundredths: 100=1x, 125=1.25x) to a
// base point amount. Kept separate from pointsForSpendCents because the
// multiplier depends on which tier the payer was in at the moment of
// earning — a fact recordNetsPayment has to look up, not something bare
// amountCents math can know.
export function applyTierMultiplier(basePoints: number, multiplierPercent: number): number {
  return Math.round((basePoints * multiplierPercent) / 100);
}

// Converts a points amount to cashback cents, at the SAME rate the catalogue
// is priced at (100 pts = $1 = 100 cents — so this is numerically just
// `points`, but written as a named function rather than relied on as a
// coincidence, so a future rate change has one place to happen). Deliberately
// not a more generous rate than the voucher catalogue — internal consistency
// is the entire point of offering cashback as an option.
export function cashbackCentsForPoints(points: number): number {
  return Math.round((points * 100) / REWARD_POINTS_PER_DOLLAR);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfThisCalendarMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// The delegates recordNetsPayment touches. Typed structurally so it accepts
// both `prisma` and the `tx` client from an interactive prisma.$transaction,
// letting callers fold the earn into a larger atomic write.
type NetsPaymentClient = Pick<PrismaClient, "account" | "transaction" | "rewardTier" | "pointLot">;

// multiplierPercent is optional on the type (not on real RewardTier rows,
// which always have it via the schema default) specifically so callers that
// predate the multiplier — src/app/preview/*, out of scope for this pass —
// can still pass their existing tier-like objects without a type error.
// Every real read of it already falls back with `?? 100`.
export type TierLike = { name: string; txnCountNeeded: number; multiplierPercent?: number };

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

// The ONE way to write a NETS payment. Debit, ledger row, tier-aware point
// award, and the PointLot that makes the award auditable/expirable/
// refundable are all issued together on the caller's client, so there is no
// code path that can record a NETS payment and quietly forget any of it.
// Callers MUST pass a $transaction client so a partial write can't survive a
// crash.
//
// Points can come out to 0 — sub-$2 spend, or the 4th+ qualifying payment to
// the same merchant today — and that's by design (see MIN_QUALIFYING_CENTS /
// MAX_DAILY_MERCHANT_QUALIFYING), not a bug. When points are 0, no PointLot
// is created at all: PointLot's existence is what "counts toward this
// month's tier progress" means (see getRewards's monthlyPaymentCount query),
// so a disqualified payment correctly doesn't advance tier progress either.
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
  const basePoints = pointsForSpendCents(payment.amountCents);

  let points = 0;
  if (basePoints > 0) {
    const monthStart = startOfThisCalendarMonth();
    const todayStart = startOfToday();

    const [priorMonthlyQualifying, priorTodaySameMerchant, tiers] = await Promise.all([
      // Same signal getRewards() uses for tier progress — a PointLot only
      // exists for a payment that actually qualified.
      client.pointLot.count({ where: { userId: payment.userId, earnedAt: { gte: monthStart } } }),
      client.transaction.count({
        where: {
          userId: payment.userId,
          description: payment.description,
          type: { in: [...NETS_PAYMENT_TYPES] },
          amountCents: { lte: -MIN_QUALIFYING_CENTS },
          createdAt: { gte: todayStart },
        },
      }),
      client.rewardTier.findMany({ where: { userId: payment.userId } }),
    ]);

    if (priorTodaySameMerchant < MAX_DAILY_MERCHANT_QUALIFYING) {
      // Multiplier is based on the tier the payer was ALREADY in before this
      // payment — not a circular "does this payment push me into a richer
      // tier that then applies to itself" computation.
      const { current } = resolveTierProgress(tiers, priorMonthlyQualifying);
      points = applyTierMultiplier(basePoints, current?.multiplierPercent ?? 100);
    }
  }

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

  if (points > 0) {
    const earnedAt = row.createdAt;
    const expiresAt = new Date(earnedAt);
    expiresAt.setMonth(expiresAt.getMonth() + POINTS_EXPIRY_MONTHS);
    await client.pointLot.create({
      data: {
        userId: payment.userId,
        transactionId: row.id,
        pointsEarned: points,
        pointsRemaining: points,
        earnedAt,
        expiresAt,
      },
    });
  }

  return { transactionId: row.id, points };
}

// Consumes `points` from a user's oldest-still-alive PointLots first (FIFO),
// so if/when expiry sweeps run, they're sweeping whatever's genuinely left
// un-spent, not double-counting points a redemption or refund already
// claimed. Used by both redeemReward (any points spend) and
// refundTransaction (clawback). Assumes the caller has ALREADY verified the
// user has enough total points — this only distributes the deduction across
// lots, it doesn't itself guard against overdrawing the account.
export async function consumePointsFifo(
  client: Pick<PrismaClient, "pointLot">,
  userId: string,
  points: number,
): Promise<void> {
  let remaining = points;
  const lots = await client.pointLot.findMany({
    where: { userId, pointsRemaining: { gt: 0 } },
    orderBy: { earnedAt: "asc" },
  });
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.pointsRemaining, remaining);
    await client.pointLot.update({
      where: { id: lot.id },
      data: { pointsRemaining: { decrement: take } },
    });
    remaining -= take;
  }
  // If `remaining` is still > 0 here, the account's points and its lots have
  // drifted (should be impossible given every earn/spend path goes through
  // this file) — nothing further to do; Account.rewardPoints is still the
  // source of truth for "can this redemption/refund proceed" and was already
  // checked by the caller before this ran.
}

// Removes any PointLot balance older than POINTS_EXPIRY_MONTHS from both the
// lots and the account total. There's no scheduler in this app (no
// deployment target for one in this pass), so this runs lazily — as a side
// effect of reading rewards data (getRewards) — rather than on a clock. That
// makes it a real, correct mechanism (an expired lot really does stop
// counting the moment this runs), just event-triggered instead of
// time-triggered.
export async function sweepExpiredPoints(
  client: Pick<PrismaClient, "account" | "pointLot">,
  userId: string,
): Promise<number> {
  const expired = await client.pointLot.findMany({
    where: { userId, pointsRemaining: { gt: 0 }, expiresAt: { lte: new Date() } },
  });
  if (expired.length === 0) return 0;

  const totalExpired = expired.reduce((sum, lot) => sum + lot.pointsRemaining, 0);

  await Promise.all(
    expired.map((lot) =>
      client.pointLot.update({ where: { id: lot.id }, data: { pointsRemaining: 0 } }),
    ),
  );
  // Clamped at 0 defensively — should already match, since consumePointsFifo
  // keeps lots and the account total in lockstep on every spend.
  await client.account.updateMany({
    where: { userId, rewardPoints: { gte: totalExpired } },
    data: { rewardPoints: { decrement: totalExpired } },
  });

  return totalExpired;
}
