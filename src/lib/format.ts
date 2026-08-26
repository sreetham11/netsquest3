// All money is stored as integer cents. These helpers format for display.

export function formatMoney(cents: number, currency = "SGD"): string {
  const value = cents / 100;
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(value);
}

// Signed amount for transactions: negative shown with a leading minus.
export function formatSignedMoney(cents: number, currency = "SGD"): string {
  const formatted = formatMoney(Math.abs(cents), currency);
  return cents < 0 ? `-${formatted}` : `+${formatted}`;
}

// Plain decimal amount, no currency symbol — for layouts that show the
// currency code as its own separate label (e.g. the Home/Activity balance
// cards: "SGD" + "84.00" as two distinct pieces, not one "S$84.00" string).
export function formatAmount(cents: number): string {
  return new Intl.NumberFormat("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDayMonth(date: Date): string {
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-SG", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
