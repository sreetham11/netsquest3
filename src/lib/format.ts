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
