// Pill-shaped progress bar per DESIGN.md ("Progress Bars: Fully rounded to
// represent fluid progress in the Rewards ecosystem"). `gold` is for bars
// living inside a Gold-tier-themed card (amber background) — the reference
// screens use gold vs. primary contextually (card theme), not tied to a
// hardcoded "current tier" check, so the caller decides which tone fits.
const FILL = {
  primary: "bg-primary",
  // Solid gold-tier, not a gradient: DESIGN.md's token set defines exactly
  // one gold hex (gold-tier). The reference screens' gold gradient uses two
  // more hex stops that exist nowhere in the shared token spec — inventing
  // them here would break this file's own "no undefined hues" rule.
  gold: "bg-gold-tier",
  error: "bg-error",
  // --- Back-compat for pages not yet in their own redesign phase (Budget) --
  // Budget is explicitly out of scope until its own phase, so its call sites
  // can't be updated to the new tone names yet either. These three keep it
  // type-compatible and visually reasonable (not "broken", just not
  // redesigned) in the meantime. Delete once Budget migrates to primary/gold/
  // error directly.
  accent: "bg-primary",
  "accent-strong": "bg-nets-blue-dark",
  danger: "bg-error",
} as const;

export function ProgressBar({
  value,
  tone = "primary",
  size = "sm",
}: {
  value: number; // 0..1
  tone?: keyof typeof FILL;
  size?: "sm" | "lg"; // "lg" opt-in only — default matches prior behavior exactly
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const fill = FILL[tone];
  const height = size === "lg" ? "h-4" : "h-2";
  return (
    <div className={`${height} w-full overflow-hidden rounded-full bg-surface-container-highest`}>
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
