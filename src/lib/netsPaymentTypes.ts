// Pure data, no server dependency — split out of rewards.ts (which is
// `server-only`, since recordNetsPayment/pointsForSpendCents there are meant
// to run server-side only) so client components can safely know which
// transaction types count as "a NETS payment" too (e.g. ActivityList's
// filter chips). Nothing here is sensitive — the client already renders
// type-derived UI (icons, tone) via txn.ts.

export const NETS_PAYMENT_TYPES = ["PAYMENT", "BILL", "VAULT"] as const;

export type NetsPaymentType = (typeof NETS_PAYMENT_TYPES)[number];

export function isNetsPaymentType(type: string): type is NetsPaymentType {
  return (NETS_PAYMENT_TYPES as readonly string[]).includes(type);
}
