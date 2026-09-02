// Segmented (blocks) counterpart to ProgressBar — same tones/tokens, for
// milestone-style progress (e.g. payments toward the next reward tier) where
// distinct steps read better at a glance than one continuous fill.
const FILL = {
  accent: "bg-accent",
  "accent-strong": "bg-accent-strong",
  danger: "bg-danger",
  // For placement on a colored/gradient surface (e.g. the tier card) — a blue
  // fill would clash with a bronze/gold background, so the unfilled track
  // becomes translucent white too rather than the usual solid neutral-200,
  // which would look like a stray grey bar floating on the gradient.
  white: "bg-white",
} as const;

const TRACK: Record<keyof typeof FILL, string> = {
  accent: "bg-neutral-200",
  "accent-strong": "bg-neutral-200",
  danger: "bg-neutral-200",
  white: "bg-white/25",
};

export function SegmentedProgressBar({
  value,
  segments = 10,
  tone = "accent",
}: {
  value: number; // 0..1, same ratio ProgressBar takes
  segments?: number;
  tone?: keyof typeof FILL;
}) {
  const pct = Math.max(0, Math.min(1, value));
  // Floor, not round: a segment only lights up once its share of progress is
  // actually complete, so the bar never reads as further along than it is.
  const filled = Math.min(segments, Math.floor(pct * segments));
  const fill = FILL[tone];
  const track = TRACK[tone];

  return (
    <div className="flex gap-1">
      {Array.from({ length: segments }, (_, i) => (
        <div
          key={i}
          className={`h-2.5 flex-1 rounded-full ${i < filled ? fill : track}`}
        />
      ))}
    </div>
  );
}
