import type { IconName } from "@/components/Icon";

// A REWARD row is $0 for a catalogue-voucher redemption (no money moves) but
// non-zero for a cashback redemption (real money credited) — only the
// former is "not a money amount"; the latter is a real, positive credit and
// should read like one (green, credit arrow, the actual $ figure).
function isPointsOnlyRedemption(type: string, amountCents: number): boolean {
  return type === "REWARD" && amountCents === 0;
}

// Picks a leading icon for a transaction row from its type/sign.
export function txnLeadingIcon(type: string, amountCents: number): IconName {
  if (isPointsOnlyRedemption(type, amountCents)) return "rewards"; // voucher redemption, not money movement
  if (amountCents > 0) return "arrow-down"; // money in — top-ups, refunds, cashback redemptions
  if (type === "BILL") return "bills";
  return "arrow-up"; // money out
}

export function amountTone(type: string, amountCents: number): "positive" | "negative" | "neutral" {
  if (isPointsOnlyRedemption(type, amountCents)) return "neutral"; // points, not a money amount — no red/blue signal
  return amountCents < 0 ? "negative" : "positive";
}

// A points-only REWARD row is a redemption at $0 — showing "+$0.00" would
// read like a bug in a money ledger, so show what actually happened instead.
// A cashback REWARD row has a real amount and shows it like any other credit.
export function txnValue(type: string, amountCents: number, formatted: string): string {
  return isPointsOnlyRedemption(type, amountCents) ? "Redeemed" : formatted;
}
