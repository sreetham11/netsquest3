import "server-only";
import { prisma } from "@/lib/prisma";
import {
  CASHBACK_REWARD_NAME,
  NETS_PAYMENT_TYPES,
  TIER_MIN_PAYMENT_CENTS,
  nextTierForMonthlyCount,
  tierForMonthlyCount,
} from "@/lib/rewards";
import { YOU_PARTICIPANT_NAME } from "@/lib/split";

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
    // Deterministic participant order: the Spin wheel renders one slice per
    // participant, so the order must not reshuffle between renders.
    include: { participants: { orderBy: { id: "asc" } } },
  });
}

// How much is owed to the current user across their splits. A split only
// has a recorded payer once Spin to Decide has run (payerParticipantId set);
// unspun splits don't attribute the bill to anyone, so they're excluded —
// same rule the Split page uses to decide when to show "owes {payer}" copy.
// Owed = unpaid participants' shares in splits where "You" (see
// YOU_PARTICIPANT_NAME) is the resolved payer.
export async function getOwedToUser(userId: string): Promise<{ owedCents: number; splitCount: number }> {
  const splits = await prisma.split.findMany({
    where: { ownerId: userId, payerParticipantId: { not: null } },
    include: { participants: true },
  });

  let owedCents = 0;
  let splitCount = 0;
  for (const split of splits) {
    const payer = split.participants.find((p) => p.id === split.payerParticipantId);
    if (payer?.name !== YOU_PARTICIPANT_NAME) continue;
    const unpaidCents = split.participants
      .filter((p) => p.id !== payer.id && !p.paid)
      .reduce((sum, p) => sum + p.shareAmountCents, 0);
    if (unpaidCents > 0) {
      owedCents += unpaidCents;
      splitCount += 1;
    }
  }
  return { owedCents, splitCount };
}

// This month's NETS payments that count toward the tier tally. Anti-farming:
// only payments of $1.00 or more are counted, so a run of tiny transactions
// can't buy a tier. Spends are stored negative, so "at least $1.00" is
// amountCents <= -100.
export async function getMonthlyQualifyingPaymentCount(userId: string) {
  return prisma.transaction.count({
    where: {
      userId,
      type: { in: [...NETS_PAYMENT_TYPES] },
      amountCents: { lte: -TIER_MIN_PAYMENT_CENTS },
      createdAt: { gte: startOfThisMonth() },
    },
  });
}

// Everything the Rewards page needs: point balance, wallet balance (cashback
// credits into it), the tier ladder + this month's progress, the redemption
// catalogue, and recent redemption history (so a reload still shows the
// confirmation — it's a real DB row, not client state).
export async function getRewards(userId: string) {
  const [account, catalogue, monthlyPaymentCount, recentRedemptions] = await Promise.all([
    prisma.account.findUnique({ where: { userId } }),
    // Cashback is a redemption *destination*, not a browsable catalogue item.
    prisma.reward.findMany({
      where: { name: { not: CASHBACK_REWARD_NAME } },
      orderBy: { pointCost: "asc" },
    }),
    getMonthlyQualifyingPaymentCount(userId),
    prisma.redemption.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { reward: true },
    }),
  ]);
  return {
    points: account?.rewardPoints ?? 0,
    balanceCents: account?.balanceCents ?? 0,
    currency: account?.currency ?? "SGD",
    currentTier: tierForMonthlyCount(monthlyPaymentCount),
    nextTier: nextTierForMonthlyCount(monthlyPaymentCount),
    catalogue,
    monthlyPaymentCount,
    recentRedemptions,
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
//
// "Overseas" is a special case: no transaction is ever WRITTEN with category
// "Overseas" (a Uniqlo Osaka purchase keeps category "Shopping" — real
// category taxonomy, unaffected). It's computed here as a separate
// cross-cutting cut of the same month's spend, reusing
// getOverseasTransactions' country-not-null filter, so it counts toward the
// Overseas budget cap on top of counting toward its real category's cap.
// That double-count is intentional (a purchase abroad is genuinely both
// "Shopping" spend and "Overseas" spend) — the underlying rows are never
// changed. getRecentSpendByCategory (Home's Top Spending Categories) is
// deliberately NOT given this treatment, so "Overseas" never appears there.
export async function getMonthlySpendByCategory(
  userId: string,
): Promise<Record<string, number>> {
  const since = startOfThisMonth();
  const [rows, overseas] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["category"],
      where: {
        userId,
        amountCents: { lt: 0 },
        createdAt: { gte: since },
      },
      _sum: { amountCents: true },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        amountCents: { lt: 0 },
        createdAt: { gte: since },
        country: { not: null },
      },
      _sum: { amountCents: true },
    }),
  ]);
  const map: Record<string, number> = {};
  for (const r of rows) map[r.category] = Math.abs(r._sum.amountCents ?? 0);
  map.Overseas = Math.abs(overseas._sum.amountCents ?? 0);
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

// Saved payees the user manages themselves — scoped to the owner like all
// other user data. Contacts are names/numbers for faster, consistent entry in
// Split; they are not real accounts and are never looked up externally.
export async function getContacts(userId: string) {
  return prisma.contact.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
}
