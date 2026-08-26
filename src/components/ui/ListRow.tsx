import type { ReactNode } from "react";

// A single row: optional leading icon/avatar, title + subtitle, and a right-aligned
// value (amount, status, etc.). Designed to stack inside a Card with divide-y,
// OR to be individually wrapped/bordered by the caller — both patterns appear
// in the reference screens (Home groups rows in one hairline-divided card;
// Activity boxes each row individually), so this stays a content primitive
// and leaves that composition choice to the page.
const LEADING_TONE = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success-green/15 text-success-green", // credit/top-up rows
  neutral: "bg-surface-container-high text-on-surface-variant",
} as const;

// IMPORTANT finding from the reference screens: negative/debit amounts render
// as plain on-surface text, NOT red — success-green is reserved exclusively
// for positive/credit amounts (Top-up, refunds). This reverses the old
// system's red-for-negative convention; red (error/secondary) stays reserved
// for genuine alerts, not routine spend.
export function ListRow({
  leading,
  leadingTone = "primary",
  title,
  subtitle,
  value,
  valueTone = "neutral",
  valueHint,
}: {
  leading?: ReactNode;
  leadingTone?: keyof typeof LEADING_TONE;
  title: string;
  subtitle?: string;
  value?: ReactNode;
  valueTone?: "neutral" | "negative" | "positive";
  valueHint?: string;
}) {
  const valueClass = valueTone === "positive" ? "text-success-green" : "text-on-surface";

  return (
    <div className="flex items-center gap-4 py-4">
      {leading ? (
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${LEADING_TONE[leadingTone]}`}
        >
          {leading}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-lg font-semibold text-on-surface">{title}</p>
        {subtitle ? (
          <p className="truncate text-label-md text-on-surface-variant">{subtitle}</p>
        ) : null}
      </div>
      {value !== undefined ? (
        <div className="shrink-0 text-right">
          <p className={"text-title-lg " + valueClass}>{value}</p>
          {valueHint ? (
            <p className="text-label-md text-on-surface-variant">{valueHint}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
