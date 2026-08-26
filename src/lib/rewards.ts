import "server-only";

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

// Transaction types that count as "paying with NETS" — they earn points AND
// count toward the monthly tier transaction count. TOPUP/INCOME are money
// coming in, not a NETS payment, so they earn nothing.
export const NETS_PAYMENT_TYPES = ["PAYMENT", "BILL", "VAULT"] as const;

// Points earned on a spend transaction: S$1 = 5 points, auto-credited with no
// separate activation step.
export function pointsForSpendCents(amountCents: number): number {
  return Math.round((Math.abs(amountCents) / 100) * POINTS_PER_DOLLAR);
}
