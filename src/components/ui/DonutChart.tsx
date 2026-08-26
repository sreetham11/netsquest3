// Multi-segment donut — locked tokens only. Segments are drawn as stacked
// arcs (blue family); whatever fraction is left unfilled shows the neutral
// track underneath, so "remaining/available" never needs its own explicit
// segment — same convention as ProgressBar/ProgressRing.
export type DonutSegment = {
  value: number; // fraction of the whole, 0..1
  className: string; // a stroke-* utility, e.g. "stroke-accent"
};

export function DonutChart({
  segments,
  size = 140,
  strokeWidth = 20,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;

  // Pure derivation (no mutation during render) — each segment's arc length
  // and its rotational offset (negative = how far around the circle the
  // segments before it already consumed).
  const clamped = segments.map((s) => Math.max(0, Math.min(1, s.value)));
  const offsets = clamped.map((_, i) => -c * clamped.slice(0, i).reduce((a, b) => a + b, 0));

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
      {segments.map((seg, i) => {
        const segLen = c * clamped[i];
        if (segLen <= 0) return null;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={strokeWidth}
            fill="none"
            className={seg.className}
            strokeDasharray={`${segLen} ${c - segLen}`}
            strokeDashoffset={offsets[i]}
          />
        );
      })}
    </svg>
  );
}
