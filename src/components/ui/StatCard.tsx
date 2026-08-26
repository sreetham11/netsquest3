import type { ReactNode } from "react";
import { Card } from "./Card";

// Compact metric tile: label + value, optional hint and trend.
// Trend "down"/negative uses red (allowed: signals a negative amount/warning),
// "up" uses neutral ink — red is never decorative and never a CTA.
// Built on the shared Card (padded={false} + p-6) rather than a hand-rolled
// div, so every card in the app shares one border/radius/shadow implementation.
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
    <Card padded={false} className="p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">{label}</p>
        {icon ? <span className="text-ink-muted">{icon}</span> : null}
      </div>
      <p
        className={
          "mt-3 text-xl font-semibold " +
          (tone === "negative" ? "text-danger-strong" : "text-ink")
        }
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-ink-muted">{hint}</p> : null}
    </Card>
  );
}
