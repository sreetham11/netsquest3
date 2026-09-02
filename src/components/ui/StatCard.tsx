import type { ReactNode } from "react";
import { Card } from "./Card";

// Compact metric tile: label + value, optional hint and trend.
// Trend "negative" uses red (allowed: signals a negative amount/warning),
// "positive" uses the brand accent blue (this app has no green token — blue
// is the only "good news" color available, same convention ListRow's
// valueTone already uses for a credit amount), "neutral" (default) is plain
// ink. Built on the shared Card (padded={false} + p-6) rather than a
// hand-rolled div, so every card in the app shares one border/radius/shadow
// implementation.
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
  tone?: "neutral" | "negative" | "positive";
  icon?: ReactNode;
}) {
  const valueClass =
    tone === "negative"
      ? "text-danger-strong"
      : tone === "positive"
        ? "text-accent"
        : "text-ink";

  return (
    <Card padded={false} className="p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">{label}</p>
        {icon ? <span className="text-ink-muted">{icon}</span> : null}
      </div>
      <p className={"mt-3 text-xl font-semibold " + valueClass}>{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-ink-muted">{hint}</p> : null}
    </Card>
  );
}
