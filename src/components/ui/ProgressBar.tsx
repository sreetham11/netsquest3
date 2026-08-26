// Progress bar — blue accent fill on a neutral track. Used for split
// settlement progress, budget usage, and reward-tier progress.
const FILL = {
  accent: "bg-accent",
  "accent-strong": "bg-accent-strong", // e.g. budget approaching its cap — still blue family, no new token
  danger: "bg-danger",
} as const;

export function ProgressBar({
  value,
  tone = "accent",
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
    <div className={`${height} w-full overflow-hidden rounded-full bg-neutral-200`}>
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
