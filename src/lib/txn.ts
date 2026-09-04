import type { IconName } from "@/components/Icon";
import { categoryIcon } from "@/lib/categoryIcon";
import { budgetCategoryToSplitCategory } from "@/lib/split";

// Picks a leading icon for a transaction row. Deliberately NON-directional:
// money in vs out is signalled once, by the amount's color (see amountTone),
// so the icon is free to say what the transaction actually was. Directional
// up/down arrows were removed app-wide as a redundant second signal.
export function txnLeadingIcon(
  type: string,
  amountCents: number,
  category: string,
): IconName {
  if (type === "REWARD") return "rewards"; // point redemption, not money movement
  if (type === "BILL") return "bills";
  if (type === "TOPUP") return "plus"; // funds added — no spend category to show
  // INCOME (e.g. "Monthly salary") has its own dedicated icon for the same
  // reason REWARD/BILL/TOPUP do above: "Income" isn't in the Budget category
  // taxonomy, so it used to fall through to categoryIcon()'s generic
  // "budget" chart-axis icon — a fallback meant for an unmatched category,
  // not a real, common transaction type, and visually off-balance (its mass
  // sits bottom-left) next to every other row's centered, symmetric icon.
  if (type === "INCOME") return "income";
  // Everything else is identified by its spending category, the same map the
  // Budget page uses. Categories outside that taxonomy still fall back to
  // the generic finance icon inside categoryIcon().
  return categoryIcon(category);
}

export function amountTone(type: string, amountCents: number): "positive" | "negative" | "neutral" {
  // A $0 REWARD row is points, not a money amount — no red/blue signal. A
  // cashback redemption is a REWARD row with a real credit, so it keeps the
  // normal money tone.
  if (type === "REWARD" && amountCents === 0) return "neutral";
  return amountCents < 0 ? "negative" : "positive";
}

// A catalogue REWARD row is a point redemption at $0 — showing "+$0.00" would
// read like a bug in a money ledger, so show what actually happened instead.
// Cashback redemptions DO move money, so they show their amount as normal.
export function txnValue(type: string, amountCents: number, formatted: string): string {
  return type === "REWARD" && amountCents === 0 ? "Redeemed" : formatted;
}

// Builds the New Split pre-fill URL from a merchant/amount/category triple —
// the one place that shape gets turned into a query string, shared by the
// transaction-row "Split" action and the post-payment "Split this?" prompt.
export function splitPrefillHref(merchant: string, amountAbsCents: number, category: string): string {
  const params = new URLSearchParams({
    merchant,
    amount: (amountAbsCents / 100).toFixed(2),
    category: budgetCategoryToSplitCategory(category),
  });
  return `/split?${params.toString()}`;
}

// Splitting only makes sense for money going out (a purchase you covered),
// not top-ups/refunds/rewards — so this returns null for anything else.
export function splitHref(description: string, amountCents: number, category: string): string | null {
  if (amountCents >= 0) return null;
  return splitPrefillHref(description, Math.abs(amountCents), category);
}

// A transaction is flagged when it's more than this many times the user's
// average spend in that category (based on their own history, not any
// external benchmark — simple rule-based comparison, no ML).
const HIGH_SPEND_MULTIPLIER = 1.5;

type CategoryStats = { totalCents: number; count: number };

// Pass the full transaction history for the user (not just what's on
// screen) — averages are meaningless over a truncated recent-N list.
export function categorySpendStats(
  txns: Array<{ category: string; amountCents: number }>,
): Record<string, CategoryStats> {
  const stats: Record<string, CategoryStats> = {};
  for (const t of txns) {
    if (t.amountCents >= 0) continue; // only outgoing spend has a "usual" amount
    const s = stats[t.category] ?? { totalCents: 0, count: 0 };
    s.totalCents += Math.abs(t.amountCents);
    s.count += 1;
    stats[t.category] = s;
  }
  return stats;
}

// Compares a transaction against the average of the OTHER transactions in
// its category (excluding itself) — otherwise a single outlier would just
// inflate its own average and could never be flagged. Needs at least one
// other same-category transaction to have anything to compare against.
export function isHigherThanUsual(
  txn: { category: string; amountCents: number },
  stats: Record<string, CategoryStats>,
): boolean {
  if (txn.amountCents >= 0) return false;
  const s = stats[txn.category];
  if (!s || s.count < 2) return false;

  const amountAbs = Math.abs(txn.amountCents);
  const othersCount = s.count - 1;
  const othersAvg = (s.totalCents - amountAbs) / othersCount;
  return othersAvg > 0 && amountAbs > HIGH_SPEND_MULTIPLIER * othersAvg;
}
