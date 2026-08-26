import type { ReactNode } from "react";
import { Card } from "./Card";

// Compact metric tile: label + value, optional hint and trend.
//
// tone="negative" uses `error`, NOT the plain on-surface treatment ListRow
// uses for routine debit amounts — a StatCard's "negative" reading (e.g.
// "Overspend") is a genuine warning about a bad state, not just a routine
// spend, so it deliberately gets the alert color. Success-green stays
// reserved for positive transaction amounts/completion, not used here.
// Built on the shared Card (padded={false} + p-stack-md) rather than a
// hand-rolled div, so every card in the app shares one border/radius/shadow.
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "negative";
  icon?: ReactNode;
}) {
  return (
    <Card padded={false} className="p-stack-md">
      <div className="flex items-center justify-between">
        <p className="text-label-md text-on-surface-variant">{label}</p>
        {icon ? <span className="text-on-surface-variant">{icon}</span> : null}
      </div>
      <p
        className={
          "mt-3 text-headline-md " + (tone === "negative" ? "text-error" : "text-on-surface")
        }
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-label-md text-on-surface-variant">{hint}</p> : null}
    </Card>
  );
}
