// The one format a NETS Quest merchant QR code encodes: a JSON string with
// exactly these three fields. Shared between the scanner (ScanPay.tsx, which
// parses a decoded string back into this shape) and the dev-only demo
// generator (scripts/generate-demo-qr.mjs, which encodes it) so both sides
// agree on the format without duplicating it.
export type NetsQrPayload = {
  merchant: string;
  category: string;
  amountCents: number;
};

// Anything that isn't valid, well-typed JSON matching this exact shape is
// treated as "not a NETS QR code" rather than partially trusted — a random
// URL, wifi QR, or garbage payload must never reach the confirm screen's
// fields. Returns null on any mismatch instead of throwing, so callers can
// treat "not ours" as an ordinary case, not an exception to catch.
export function parseNetsQrPayload(raw: string): NetsQrPayload | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { merchant, category, amountCents } = data as Record<string, unknown>;
  if (typeof merchant !== "string" || merchant.trim().length === 0) return null;
  if (typeof category !== "string" || category.trim().length === 0) return null;
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents) || amountCents <= 0) {
    return null;
  }
  return { merchant: merchant.trim(), category: category.trim(), amountCents: Math.round(amountCents) };
}
