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
  actions,
  badge,
  caption,
  subtitleWrap = false,
  reserveActionsSpace = false,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  value?: ReactNode;
  valueTone?: "neutral" | "negative" | "positive";
  valueHint?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  // Full-width note below the row (e.g. an alert), indented to align with
  // the title/subtitle column rather than sharing their line.
  caption?: ReactNode;
  // Off by default — subtitle truncates to one line, which is right for
  // every space-constrained consumer (transaction descriptions, contact
  // names, etc.). Opt in when the subtitle is real copy that needs to be
  // read in full (e.g. Rewards' tier descriptions) — it wraps to a second
  // line instead of clipping.
  subtitleWrap?: boolean;
  // Set on EVERY row in a list where only SOME rows pass `actions` (e.g.
  // Transactions' per-row "Split" icon) — reserves the action column's
  // width even on rows with none, so the value column's right edge stays
  // on one straight line down the whole list instead of shifting per row.
  // Leave off (default) for any list where actions is either always or
  // never present — there, the old presence-only rendering already lines
  // up fine and this would just add an unneeded gap.
  reserveActionsSpace?: boolean;
}) {
  const valueClass =
    valueTone === "negative"
      ? "text-danger-strong"
      : valueTone === "positive"
        ? "text-accent"
        : "text-ink";

  return (
    <div>
      <div className={"flex items-center gap-3 " + (caption ? "pt-4" : "py-4")}>
        {leading ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
            {leading}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{title}</p>
          {subtitle || badge ? (
            <div className="flex items-center gap-2">
              {subtitle ? (
                <p
                  className={
                    (subtitleWrap ? "" : "truncate ") + "text-sm text-ink-muted"
                  }
                >
                  {subtitle}
                </p>
              ) : null}
              {badge ? <span className="shrink-0">{badge}</span> : null}
            </div>
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
        {/* Reserves the SAME width whether or not this row actually has an
            action (e.g. Transactions' per-row "Split" icon, only shown on
            some rows) — otherwise the value column's right edge shifts row
            to row depending on which ones have one, breaking the straight
            vertical column a list of amounts should read as. w-8 matches
            the action icon's own h-8 w-8 sizing exactly. */}
        {actions ? (
          <div className="w-8 shrink-0">{actions}</div>
        ) : reserveActionsSpace ? (
          <div aria-hidden className="w-8 shrink-0" />
        ) : null}
      </div>
      {caption ? (
        <div className={"pb-4 text-xs " + (leading ? "pl-[52px]" : "")}>{caption}</div>
      ) : null}
    </div>
  );
}
