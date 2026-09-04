// Shared helper for any simulated in-app payment flow (Scan & Pay, and now
// AI Deal Finder's mock checkout) — NOT a real payment-network reference
// number. Kept here so it's defined once, not copy-pasted per flow.
export function randomTransactionRef(): string {
  let ref = "";
  for (let i = 0; i < 12; i++) ref += Math.floor(Math.random() * 10);
  return ref;
}
