import type { IconName } from "@/components/Icon";

// Picks a leading icon for a transaction row from its type/sign.
export function txnLeadingIcon(type: string, amountCents: number): IconName {
  if (type === "REWARD") return "rewards"; // point redemption, not money movement
  if (amountCents > 0) return "arrow-down"; // money in
  if (type === "BILL") return "bills";
  return "arrow-up"; // money out
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
