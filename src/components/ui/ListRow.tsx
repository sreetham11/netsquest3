import type { ReactNode } from "react";

// A single row: optional leading icon/avatar, title + subtitle, and a right-aligned
// value (amount, status, etc.). Designed to stack inside a Card with divide-y.
export function ListRow({
  leading,
  title,
  subtitle,
  value,
  valueTone = "neutral",
  valueHint,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  value?: ReactNode;
  valueTone?: "neutral" | "negative" | "positive";
  valueHint?: string;
}) {
  const valueClass =
    valueTone === "negative"
      ? "text-danger-strong"
      : valueTone === "positive"
        ? "text-accent"
        : "text-ink";

  return (
    <div className="flex items-center gap-3 py-4">
      {leading ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
          {leading}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{title}</p>
        {subtitle ? (
          <p className="truncate text-sm text-ink-muted">{subtitle}</p>
        ) : null}
      </div>
      {value !== undefined ? (
        <div className="shrink-0 text-right">
          <p className={"text-sm font-semibold " + valueClass}>{value}</p>
          {valueHint ? (
            <p className="text-xs text-ink-muted">{valueHint}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
