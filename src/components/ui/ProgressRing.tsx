// Circular counterpart to ProgressBar — same tones/tokens, for a summary
// figure that should read as more prominent than the per-row bars around it.
const STROKE = {
  accent: "stroke-accent",
  "accent-strong": "stroke-accent-strong",
  danger: "stroke-danger",
} as const;

export function ProgressRing({
  value,
  tone = "accent",
  size = 96,
  strokeWidth = 10,
}: {
  value: number; // 0..1
  tone?: keyof typeof STROKE;
  size?: number;
  strokeWidth?: number;
}) {
  const pct = Math.max(0, Math.min(1, value));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={strokeWidth}
        className="stroke-neutral-200"
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        className={STROKE[tone]}
        style={{ strokeDasharray: c, strokeDashoffset: c * (1 - pct) }}
      />
    </svg>
  );
}
