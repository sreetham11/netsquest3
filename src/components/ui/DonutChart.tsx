"use client";

import { useEffect, useState } from "react";

// Multi-segment donut — locked tokens only. Segments are drawn as stacked
// arcs (blue family); whatever fraction is left unfilled shows the neutral
// track underneath, so "remaining/available" never needs its own explicit
// segment — same convention as ProgressBar/ProgressRing.
export type DonutSegment = {
  value: number; // fraction of the whole, 0..1
  className: string; // a stroke-* utility, e.g. "stroke-accent"
};

// A single segment holding almost the whole ring WHILE other nonzero
// segments exist isn't a plausible real spending mix — that pattern only
// shows up when a wrong-magnitude or non-spend value leaks into the total
// upstream (e.g. the bug this guards against: a top-up summed alongside
// real spend). A category that's genuinely 100% of spend (the only category
// present) is fine and isn't flagged — there's nothing to visually distort
// when there's nothing else to compare it against.
const DOMINANT_SHARE_THRESHOLD = 0.98;

// Subtle, quick draw-in — see ease/duration notes below.
const ANIMATION_MS = 700;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

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

  // Pure derivation (no mutation during render) — each segment's target
  // fraction and its rotational offset (negative = how far around the
  // circle the segments before it already consumed). These are the FINAL,
  // un-animated positions — animation only scales each segment's drawn
  // length (see `progress` below), never its start angle, so segments grow
  // outward from their fixed position rather than sliding into place.
  const clamped = segments.map((s) => Math.max(0, Math.min(1, s.value)));

  // Defense-in-depth, not the primary fix (that's upstream — see
  // getRecentSpendByCategory's type filter). If this ever fires anyway,
  // don't silently plot a chart that reads as "100% one category" — fall
  // back to the plain empty track and log loudly, since that's a real signal
  // something upstream is wrong, not a rendering nitpick.
  const dominantIndex = clamped.findIndex((v) => v >= DOMINANT_SHARE_THRESHOLD);
  const anomalous = dominantIndex !== -1 && clamped.some((v, i) => i !== dominantIndex && v > 0);
  if (anomalous) {
    console.error(
      `DonutChart: segment ${dominantIndex} holds ${(clamped[dominantIndex] * 100).toFixed(1)}% of the total while other nonzero segments exist — refusing to render a misleading chart. This usually means a non-spend or wrong-magnitude value got summed into the total upstream.`,
    );
  }
  const renderedSegments = anomalous ? [] : segments;
  const renderedClamped = anomalous ? [] : clamped;
  const offsets = renderedClamped.map((_, i) => -c * renderedClamped.slice(0, i).reduce((a, b) => a + b, 0));

  // Identifies "the data this chart represents" so the draw-in animation
  // re-triggers whenever the real numbers change, not just on first mount —
  // Home re-renders with a freshly-allocated segments array on every server
  // round-trip even when nothing actually changed, so a reference check
  // isn't enough.
  const dataKey = renderedSegments.map((s) => `${s.value.toFixed(6)}:${s.className}`).join("|");
  const [prevDataKey, setPrevDataKey] = useState(dataKey);
  const [progress, setProgress] = useState(0);
  // Resetting synchronously during render (React's documented pattern for
  // "adjusting state when a prop changes") rather than in an effect — an
  // effect-based reset would let one frame paint at the PREVIOUS progress
  // value against the NEW segment data first, flashing a fully-drawn chart
  // before it visibly snapped back to 0 and re-animated.
  if (dataKey !== prevDataKey) {
    setPrevDataKey(dataKey);
    setProgress(0);
  }

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / ANIMATION_MS);
      setProgress(easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [dataKey]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={strokeWidth}
        className="stroke-surface-container-highest"
        fill="none"
      />
      {renderedSegments.map((seg, i) => {
        const segLen = c * renderedClamped[i] * progress;
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
