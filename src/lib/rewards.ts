import "server-only";

// NETS Miles economy — the single source of truth for earn, tiers, and
// redemption. Every rate below is defined once here; nothing else in the app
// may hardcode a points rate.
//
//   Pay with NETS -> Earn Miles -> See Progress -> Redeem -> Choose NETS again
//
// NET RATE: earn 1 point per $1 spent, redeem 100 points for $1.00.
//   $100 spent -> 100 points -> $1.00 back == 1% cashback at Bronze.
//   Tier multipliers lift the earn side only: Silver 1.2% , Gold 1.5%.

// --- Earn ------------------------------------------------------------------

// 1 point per $1 spent (was 5 — that made the net rate 5%, not 1%).
export const POINTS_PER_DOLLAR = 1;

// Transaction types that count as "paying with NETS" — they earn points AND
// count toward the monthly tier tally. TOPUP/INCOME are money coming in, not a
// NETS payment, so they earn nothing and never count toward a tier.
export const NETS_PAYMENT_TYPES = ["PAYMENT", "BILL", "VAULT"] as const;

// --- Redeem ----------------------------------------------------------------

// 100 points = $1.00. Since $1.00 is 100 cents, 1 point is worth exactly 1
// cent — but always go through these helpers, never assume the 1:1.
export const POINTS_PER_DOLLAR_REDEEMED = 100;

// A checkout discount can never wipe out more than half the payment, so a big
// points balance can't zero out a large bill. Enforced server-side.
export const MILES_MAX_DISCOUNT_RATIO = 0.5;

// --- Tiers -----------------------------------------------------------------

// Tiers key off monthly NETS-payment COUNT, not spend — the goal is
// payment-method preference (choose NETS often), not higher spend.
export type Tier = {
  name: string;
  perk: string;
  minMonthlyPayments: number;
  multiplier: number;
};

export const TIERS: readonly Tier[] = [
  { name: "Bronze", perk: "1x Miles on every NETS payment.", minMonthlyPayments: 0, multiplier: 1 },
  { name: "Silver", perk: "1.2x Miles on every NETS payment, once you hit 10+ payments this month.", minMonthlyPayments: 10, multiplier: 1.2 },
  { name: "Gold", perk: "1.5x Miles on every NETS payment, once you hit 25+ payments this month.", minMonthlyPayments: 25, multiplier: 1.5 },
] as const;

// Anti-farming: only payments of $1.00 or more count toward the monthly tier
// tally, so a run of tiny transactions can't buy a tier.
export const TIER_MIN_PAYMENT_CENTS = 100;

// The catalogue row that backs a direct-cashback redemption. Cashback is not a
// browsable catalogue item, so it is excluded from the redeemable list — it
// exists only to satisfy Redemption's required reward relation.
export const CASHBACK_REWARD_NAME = "Cashback";

// --- Formulas --------------------------------------------------------------

// Points earned on a spend: 1 point per $1, then the tier multiplier.
export function pointsForSpendCents(amountCents: number, multiplier = 1): number {
  const base = Math.round((Math.abs(amountCents) / 100) * POINTS_PER_DOLLAR);
  return Math.round(base * multiplier);
}

// Cash value of a points balance, in cents (100 points -> 100 cents).
export function centsFromPoints(points: number): number {
  return Math.floor((points / POINTS_PER_DOLLAR_REDEEMED) * 100);
}

// Points needed to cover a given number of cents.
export function pointsForCents(cents: number): number {
  return Math.ceil((cents / 100) * POINTS_PER_DOLLAR_REDEEMED);
}

// Largest discount (in cents) that may be applied to a payment: capped at
// MILES_MAX_DISCOUNT_RATIO of the amount, and by what the balance can cover.
export function maxMilesDiscountCents(amountCents: number, pointsBalance: number): number {
  const cap = Math.floor(amountCents * MILES_MAX_DISCOUNT_RATIO);
  const affordable = centsFromPoints(Math.max(0, pointsBalance));
  return Math.max(0, Math.min(cap, affordable));
}

// Highest tier unlocked by this month's qualifying payment count.
export function tierForMonthlyCount(count: number): Tier {
  return (
    [...TIERS].reverse().find((t) => count >= t.minMonthlyPayments) ?? TIERS[0]
  );
}

// The next tier up, or null when already at the top.
export function nextTierForMonthlyCount(count: number): Tier | null {
  return TIERS.find((t) => t.minMonthlyPayments > count) ?? null;
}
