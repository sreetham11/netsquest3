import "server-only";
import { prisma } from "@/lib/prisma";
import { sweepExpiredPoints } from "@/lib/rewards";
import { NETS_PAYMENT_TYPES } from "@/lib/netsPaymentTypes";

export function startOfThisMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function daysRemainingInMonth(): number {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(1, daysInMonth - now.getDate() + 1);
}

export async function getAccount(userId: string) {
  return prisma.account.findUnique({ where: { userId } });
}

export async function getRecentTransactions(userId: string, take = 6) {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getAllTransactions(userId: string) {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOverseasTransactions(userId: string) {
  return prisma.transaction.findMany({
    where: { userId, country: { not: null } },
    orderBy: { createdAt: "desc" },
  });
}

// Splits are name-only (no real linked accounts), so visibility is simply
// "you created it" — most recent first, since these are instant/short-lived.
export async function getSplits(userId: string) {
  return prisma.split.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    include: { participants: true },
  });
}

// How soon an expiring lot counts as "worth a heads-up" in the UI.
const EXPIRY_WARNING_DAYS = 60;

// Everything the Rewards page needs: point balance, tiers (keyed to monthly
// NETS-payment count), the redemption catalogue, recent redemption history (so
// a reload still shows the confirmation — it's a real DB row, not client
// state), and the recent point-earning events behind the balance.
export async function getRewards(userId: string) {
  // Runs first and awaited on its own: it can WRITE (deduct expired points),
  // so everything read below has to happen after it, not concurrently with
  // it — there's no scheduler in this app, so this is where the 12-month
  // expiry actually takes effect (see sweepExpiredPoints's own comment).
  await sweepExpiredPoints(prisma, userId);

  const expiryWarningCutoff = new Date();
  expiryWarningCutoff.setDate(expiryWarningCutoff.getDate() + EXPIRY_WARNING_DAYS);

  const [account, tiers, catalogue, monthlyPaymentCount, recentRedemptions, recentLots, expiringLots] =
    await Promise.all([
      prisma.account.findUnique({ where: { userId } }),
      prisma.rewardTier.findMany({
        where: { userId },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.reward.findMany({ orderBy: { pointCost: "asc" } }),
      // Tier progress is a COUNT of this calendar month's QUALIFYING NETS
      // payments, never a sum of spend — see the RewardTier comment in
      // prisma/schema.prisma. Counting PointLots rather than Transactions
      // directly: a lot only exists for a payment that actually earned
      // points, so this automatically excludes sub-$2 payments and any
      // payment that hit the per-merchant daily cap (src/lib/rewards.ts)
      // without needing a second filter to stay in sync with that logic.
      // Recomputed here on every load, so it resets on its own when the
      // month rolls over and reads 0 (= entry tier) for a user who hasn't
      // qualified yet.
      prisma.pointLot.count({
        where: { userId, earnedAt: { gte: startOfThisMonth() } },
      }),
      prisma.redemption.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { reward: true },
      }),
      // Earn history reads the ACTUAL awarded points from PointLot, not a
      // recompute off amountCents — recomputing would be wrong once a tier
      // multiplier exists, since it depends on which tier applied at the
      // time, not just the spend amount. include: transaction pulls the
      // description/category for display in one query.
      prisma.pointLot.findMany({
        where: { userId },
        orderBy: { earnedAt: "desc" },
        take: 5,
        include: { transaction: true },
      }),
      prisma.pointLot.findMany({
        where: { userId, pointsRemaining: { gt: 0 }, expiresAt: { lte: expiryWarningCutoff } },
        orderBy: { expiresAt: "asc" },
      }),
    ]);

  return {
    points: account?.rewardPoints ?? 0,
    tiers,
    catalogue,
    monthlyPaymentCount,
    recentRedemptions,
    recentPointEvents: recentLots.map((lot) => ({
      id: lot.id,
      description: lot.transaction.description,
      category: lot.transaction.category,
      createdAt: lot.earnedAt,
      points: lot.pointsEarned,
    })),
    // Soonest-expiring batch worth a heads-up, if any — null when nothing
    // expires within EXPIRY_WARNING_DAYS.
    expiringSoon:
      expiringLots.length > 0
        ? {
            points: expiringLots.reduce((sum, lot) => sum + lot.pointsRemaining, 0),
            earliestExpiresAt: expiringLots[0].expiresAt,
          }
        : null,
  };
}

// Merchant cashback marketplace — global catalogue, not user-scoped.
export async function getMerchantDeals() {
  return prisma.merchantDeal.findMany({ orderBy: { sortOrder: "asc" } });
}

// Home's Spending Plan card: this month's balance split into what's already
// committed. "Planned" = unpaid recurring bills (a known near-term
// commitment); "other" = non-bill spend that's already happened this month;
// "available" = whatever's left of the balance after both.
export async function getSpendingPlan(userId: string) {
  const since = startOfThisMonth();
  const [account, bills, monthTxns] = await Promise.all([
    prisma.account.findUnique({ where: { userId } }),
    prisma.recurringBill.findMany({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId, createdAt: { gte: since }, amountCents: { lt: 0 } },
    }),
  ]);

  const plannedCents = bills
    .filter((b) => !b.lastPaidAt || b.lastPaidAt < since)
    .reduce((s, b) => s + b.amountCents, 0);

  const otherCents = monthTxns
    .filter((t) => t.type !== "BILL")
    .reduce((s, t) => s + Math.abs(t.amountCents), 0);

  const balanceCents = account?.balanceCents ?? 0;
  const availableCents = Math.max(0, balanceCents - plannedCents - otherCents);

  return { balanceCents, plannedCents, otherCents, availableCents };
}

// Monthly spend per category (absolute cents), for budget tracking.
export async function getMonthlySpendByCategory(
  userId: string,
): Promise<Record<string, number>> {
  const rows = await prisma.transaction.groupBy({
    by: ["category"],
    where: {
      userId,
      amountCents: { lt: 0 },
      createdAt: { gte: startOfThisMonth() },
    },
    _sum: { amountCents: true },
  });
  const map: Record<string, number> = {};
  for (const r of rows) map[r.category] = Math.abs(r._sum.amountCents ?? 0);
  return map;
}

// Home's "Top Spending Categories" — a rolling window rather than
// getMonthlySpendByCategory's calendar-month cutoff, so it stays populated
// for any account once the calendar rolls past the month its demo data was
// seeded in (Budget's calendar-month scoping is correct for its use case —
// actual monthly caps — so that query is intentionally left as-is).
export async function getRecentSpendByCategory(
  userId: string,
  days = 30,
): Promise<Record<string, number>> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await prisma.transaction.groupBy({
    by: ["category"],
    where: {
      userId,
      // Real spend only — a negative amountCents alone doesn't guarantee
      // that (a TOPUP/etc shouldn't ever be negative, but if one is, or any
      // other non-payment type ends up negative, it must not be counted as
      // spending here). Same "counts as real spend" set used throughout the
      // rest of this codebase (ActivityList's Payments filter, the daily-
      // merchant cap in recordNetsPayment), not a new, one-off condition.
      type: { in: [...NETS_PAYMENT_TYPES] },
      amountCents: { lt: 0 },
      createdAt: { gte: since },
    },
    _sum: { amountCents: true },
  });
  const map: Record<string, number> = {};
  for (const r of rows) map[r.category] = Math.abs(r._sum.amountCents ?? 0);
  return map;
}

export async function getBudgets(userId: string) {
  const [caps, spend] = await Promise.all([
    prisma.budgetCap.findMany({ where: { userId }, orderBy: { category: "asc" } }),
    getMonthlySpendByCategory(userId),
  ]);
  return caps.map((cap) => ({
    ...cap,
    spentCents: spend[cap.category] ?? 0,
  }));
}

export async function getBills(userId: string) {
  return prisma.recurringBill.findMany({
    where: { userId },
    orderBy: { dueDayOfMonth: "asc" },
  });
}
