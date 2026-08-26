import "server-only";
import { prisma } from "@/lib/prisma";
import { isNetsPaymentType, pointsForSpendCents, type NetsPaymentType } from "@/lib/rewards";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// Global demo catalogue — fixed, not per-user. Seeded once; safe to call on
// every signup because it's keyed on the unique `name` and short-circuits once
// rows exist.
export async function ensureRewardCatalogue() {
  const count = await prisma.reward.count();
  if (count > 0) return;

  await prisma.reward.createMany({
    data: [
      { name: "Coffee", pointCost: 500, category: "coffee", sortOrder: 0 },
      { name: "Bubble Tea", pointCost: 800, category: "bubble-tea", sortOrder: 1 },
      { name: "Fast Food", pointCost: 1_500, category: "fast-food", sortOrder: 2 },
      { name: "Movie Ticket", pointCost: 3_000, category: "movie-ticket", sortOrder: 3 },
      { name: "NTUC Voucher", pointCost: 5_000, category: "voucher", sortOrder: 4 },
    ],
    skipDuplicates: true,
  });
}

// Merchant cashback marketplace — global, not per-user, seeded once. Static
// demo content, not a live merchant API.
export async function ensureMerchantDeals() {
  const count = await prisma.merchantDeal.count();
  if (count > 0) return;

  await prisma.merchantDeal.createMany({
    data: [
      { merchant: "Koufu", category: "food", offer: "10% off", sortOrder: 0 },
      { merchant: "Sheng Siong", category: "grocery", offer: "Free delivery", sortOrder: 1 },
      { merchant: "Cheers", category: "convenience", offer: "5% cashback", sortOrder: 2 },
      { merchant: "Starbucks", category: "cafe", offer: "15% off", sortOrder: 3 },
      { merchant: "Grab", category: "ride", offer: "$3 off rides", sortOrder: 4 },
      { merchant: "Guardian", category: "pharmacy", offer: "10% off", sortOrder: 5 },
      { merchant: "Golden Village", category: "cinema", offer: "1-for-1 tickets", sortOrder: 6 },
      { merchant: "FairPrice", category: "grocery", offer: "5% cashback", sortOrder: 7 },
    ],
    skipDuplicates: true,
  });
}

// Seeds a realistic, fully user-scoped dataset for a new account. Idempotent:
// if the user already has an Account, does nothing.
export async function ensureUserData(userId: string, email: string) {
  const existing = await prisma.account.findUnique({ where: { userId } });
  if (existing) return;

  await ensureRewardCatalogue();
  await ensureMerchantDeals();

  const ownerName = email.split("@")[0].replace(/[+.].*$/, "") || "You";

  const transactions: Array<{
    description: string;
    category: string;
    amountCents: number;
    type: NetsPaymentType | "INCOME";
    country?: string;
    currencyLocal?: string;
    amountLocalCents?: number;
    createdAt: Date;
  }> = [
    { description: "Monthly salary", category: "Income", amountCents: 320_000, type: "INCOME", createdAt: daysAgo(0) },
    { description: "Kopitiam", category: "Food", amountCents: -480, type: "PAYMENT", createdAt: daysAgo(0) },
    { description: "Grab ride", category: "Transport", amountCents: -1_450, type: "PAYMENT", createdAt: daysAgo(1) },
    { description: "NTUC FairPrice", category: "Groceries", amountCents: -6_820, type: "PAYMENT", createdAt: daysAgo(1) },
    { description: "Shopee order", category: "Shopping", amountCents: -3_299, type: "PAYMENT", createdAt: daysAgo(2) },
    { description: "Starbucks", category: "Food", amountCents: -720, type: "PAYMENT", createdAt: daysAgo(2) },
    { description: "Netflix", category: "Entertainment", amountCents: -1_998, type: "BILL", createdAt: daysAgo(3) },
    { description: "Daiso", category: "Shopping", amountCents: -530, type: "PAYMENT", country: "Japan", currencyLocal: "JPY", amountLocalCents: 60_000, createdAt: daysAgo(6) },
    { description: "Uniqlo Osaka", category: "Shopping", amountCents: -4_200, type: "PAYMENT", country: "Japan", currencyLocal: "JPY", amountLocalCents: 480_000, createdAt: daysAgo(7) },
    { description: "7-Eleven Bangkok", category: "Food", amountCents: -310, type: "PAYMENT", country: "Thailand", currencyLocal: "THB", amountLocalCents: 8_000, createdAt: daysAgo(9) },
  ];

  // Same formula the live actions use (src/lib/rewards.ts) — every NETS
  // payment in the seed earns points, so a fresh demo account already shows
  // real progress instead of a placeholder number. INCOME is skipped here for
  // the same reason it earns nothing at runtime: it's money coming in.
  const rewardPoints = transactions
    .filter((t) => isNetsPaymentType(t.type))
    .reduce((sum, t) => sum + pointsForSpendCents(t.amountCents), 0);

  // Opening balance and the rows those points were computed from go in one
  // transaction — the same invariant recordNetsPayment enforces at runtime. If
  // the ledger write failed on its own, the account would open with points that
  // no transaction explains, and nothing recomputes the balance afterwards.
  await prisma.$transaction([
    prisma.account.create({
      data: {
        userId,
        balanceCents: 124_000,
        currency: "SGD",
        rewardPoints,
      },
    }),
    prisma.transaction.createMany({
      data: transactions.map((t) => ({ ...t, userId })),
    }),
  ]);

  // Instant bill splits — name-only participants, no invites/real accounts.
  await prisma.split.create({
    data: {
      ownerId: userId,
      title: "Dinner at Din Tai Fung",
      totalAmountCents: 12_800,
      category: "food",
      participants: {
        create: [
          { name: ownerName, shareAmountCents: 4_267, paid: true },
          { name: "Wei Jie", shareAmountCents: 4_267, paid: true },
          { name: "Priya", shareAmountCents: 4_266, paid: false },
        ],
      },
    },
  });

  await prisma.split.create({
    data: {
      ownerId: userId,
      title: "Grab ride split",
      totalAmountCents: 1_800,
      category: "ride",
      participants: {
        create: [
          { name: ownerName, shareAmountCents: 900, paid: true },
          { name: "Wei Jie", shareAmountCents: 900, paid: false },
        ],
      },
    },
  });

  // Tiers key off monthly NETS-payment COUNT, not spend — see src/lib/rewards.ts.
  await prisma.rewardTier.createMany({
    data: [
      { userId, name: "Bronze", perk: "Standard earn rate", txnCountNeeded: 0, sortOrder: 0 },
      { userId, name: "Silver", perk: "Early access to promos", txnCountNeeded: 20, sortOrder: 1 },
      { userId, name: "Gold", perk: "Bonus point multiplier on weekends", txnCountNeeded: 50, sortOrder: 2 },
      { userId, name: "Platinum", perk: "Premium partner offers + exclusive rewards", txnCountNeeded: 100, sortOrder: 3 },
    ],
  });

  // Caps are tuned against the fixed seeded spend above (Food $15.10,
  // Transport $14.50, Groceries $68.20, Shopping $80.29) so a fresh demo
  // account visibly exercises all three Budget risk tiers out of the box —
  // safe/blue (Food ~38%), approaching/darker-blue (Transport ~81%,
  // Groceries ~76%), and over/red (Shopping ~124%) — instead of every
  // category sitting under 20% and looking identically "fine."
  await prisma.budgetCap.createMany({
    data: [
      { userId, category: "Food", limitCents: 4_000 },
      { userId, category: "Transport", limitCents: 1_800 },
      { userId, category: "Shopping", limitCents: 6_500 },
      { userId, category: "Groceries", limitCents: 9_000 },
    ],
  });

  await prisma.recurringBill.createMany({
    data: [
      { userId, name: "Netflix", category: "Entertainment", amountCents: 1_998, dueDayOfMonth: 5, autopay: true },
      { userId, name: "Circles.Life mobile", category: "Utilities", amountCents: 4_590, dueDayOfMonth: 12, autopay: true },
      { userId, name: "StarHub broadband", category: "Utilities", amountCents: 4_900, dueDayOfMonth: 18, autopay: false },
      { userId, name: "Spotify", category: "Entertainment", amountCents: 1_490, dueDayOfMonth: 22, autopay: true },
    ],
  });
}
