// Foreign-currency display for overseas transactions.
//
// ⚠️ ILLUSTRATIVE DEMO RATES — NOT LIVE DATA. These are hardcoded, static,
// approximate rates used purely so the demo can show a plausible SGD
// equivalent next to a foreign amount. They are not fetched from any FX
// provider, are not updated, and must never be treated as real quotes or used
// to settle anything. The authoritative SGD figure for a transaction is
// always the settled `amountCents` on the row itself; the converted value
// below is shown as an approximation ("≈") only.
//
// Keyed by ISO code -> SGD per 1 unit of that currency.
export const DEMO_FX_RATES_TO_SGD: Record<string, number> = {
  MYR: 0.29,
  THB: 0.037,
  USD: 1.35,
  JPY: 0.0086,
};

export function hasDemoRate(currency: string | null | undefined): boolean {
  return !!currency && currency in DEMO_FX_RATES_TO_SGD;
}

// Approximate SGD value (in cents) of a local-currency amount (in minor
// units), using the illustrative rates above. Returns null when the currency
// isn't in the demo map, so callers can fall back rather than guess.
export function approxSgdCentsFromLocal(
  amountLocalCents: number,
  currency: string | null | undefined,
): number | null {
  if (!hasDemoRate(currency)) return null;
  const rate = DEMO_FX_RATES_TO_SGD[currency as string];
  return Math.round(Math.abs(amountLocalCents) * rate);
}

// "MYR 45.00" — plain code + amount, deliberately not locale-symbolized so
// the foreign currency is unambiguous.
export function formatLocalAmount(amountLocalCents: number, currency: string): string {
  return `${currency} ${(Math.abs(amountLocalCents) / 100).toFixed(2)}`;
}

// "MYR 45.00 (≈ SGD 13.20)" — the display format for an overseas amount.
// Falls back to just the local amount when the currency has no demo rate.
export function formatLocalWithSgd(
  amountLocalCents: number,
  currency: string,
): string {
  const local = formatLocalAmount(amountLocalCents, currency);
  const sgdCents = approxSgdCentsFromLocal(amountLocalCents, currency);
  if (sgdCents === null) return local;
  return `${local} (≈ SGD ${(sgdCents / 100).toFixed(2)})`;
}
