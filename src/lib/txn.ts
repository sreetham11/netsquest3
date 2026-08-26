import type { IconName } from "@/components/Icon";

// Picks a leading icon for a transaction row from its type/sign.
export function txnLeadingIcon(type: string, amountCents: number): IconName {
  if (type === "REWARD") return "rewards"; // point redemption, not money movement
  if (amountCents > 0) return "arrow-down"; // money in
  if (type === "BILL") return "bills";
  return "arrow-up"; // money out
}

export function amountTone(type: string, amountCents: number): "positive" | "negative" | "neutral" {
  if (type === "REWARD") return "neutral"; // points, not a money amount — no red/blue signal
  return amountCents < 0 ? "negative" : "positive";
}

// A REWARD row is a point redemption at $0 — showing "+$0.00" would read like
// a bug in a money ledger, so show what actually happened instead.
export function txnValue(type: string, amountCents: number, formatted: string): string {
  return type === "REWARD" ? "Redeemed" : formatted;
}
