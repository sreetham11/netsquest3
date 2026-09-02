// "People connected through payments" background scene for the pre-login
// screens (/splash, /welcome) — a small cluster of seated human silhouettes
// in the lower portion of the frame, behind the compass mark/wordmark.
// Original inline SVG, no imported image.
//
// Each figure is built from simple solid primitives (one circle for the
// head, four rounded "pill" capsules for torso/thigh/shin/arm — a rect with
// fully- or partially-rounded ends, positioned+rotated), NOT a hand-drawn
// outline path and NOT the small stroke-icon "contacts" glyph from
// Icon.tsx. The pose — seated, knee bent ~90° from hip to ground, one arm
// resting down onto the knee, side profile — is what makes it read as a
// person at a glance despite having no face/hair/clothing detail. All
// primitives in one figure share a single fill + a single group-level
// `opacity`, so overlapping parts of the SAME figure merge into one flat
// silhouette mass first (no visible seams at the joints) before the whole
// figure is composited translucently against whatever's behind it.
//
// preserveAspectRatio="none" is deliberate, not an oversight: with a fixed
// 390-wide mobile frame but a viewport-dependent height, "xMidYMid slice"
// (the usual cover-and-crop choice) scales up to match height and CROPS
// both horizontal edges to compensate — on a typical phone height that
// silently clips a meaningful strip off each side. "none" maps the 390-wide
// viewBox to the frame's width 1:1 (zero horizontal crop, guaranteed) and
// only stretches/squashes vertically to fit whatever height actually
// renders — an acceptable trade for loose abstract silhouettes, not for
// something needing pixel-exact proportions.

type Placement = {
  x: number;
  groundY: number;
  scale: number;
  flip: boolean;
  color: "var(--color-brand-blue)" | "var(--color-brand-red)";
  opacity: number;
};

// One seated figure, in its own local coordinate space (drawn facing left:
// thigh/shin/arm extend toward lower x). `flip` mirrors it to face right.
function SeatedFigure({ color, opacity }: { color: string; opacity: number }) {
  return (
    <g fill={color} opacity={opacity}>
      {/* Head */}
      <circle cx="55" cy="15" r="13" />
      {/* Torso — soft vertical capsule, shoulders to hip */}
      <rect x="42" y="25" width="27" height="35" rx="13" />
      {/* Thigh — hip to knee, nearly horizontal (pulled up while seated) */}
      <rect x="0" y="-6.5" width="40" height="13" rx="5" transform="translate(56 58) rotate(172)" />
      {/* Shin — knee to ground, nearly vertical (the ~90 deg bend at the
          knee is what reads as "seated" rather than standing/generic) */}
      <rect x="0" y="-6" width="36" height="12" rx="5" transform="translate(16.4 63.6) rotate(95)" />
      {/* Arm — shoulder resting down onto the knee */}
      <rect x="0" y="-4.5" width="42" height="9" rx="4.5" transform="translate(52 30) rotate(140)" />
    </g>
  );
}

// 4 figures (not 5): at a scale large enough to satisfy "20-32% of screen
// height each", 5 figures' combined width exceeds a 390px frame by enough
// that fitting them needs ~45%+ mutual overlap — tried it, it reads as one
// blended blob, not 5 people (see git history / design discussion). 4
// figures fit with ~30% overlap, which stays individually readable: each
// head/torso/leg is still distinguishable from its neighbor.
//
// Placements were derived from explicit occupied-pixel-range math (not
// eyeballed, checked-after-the-fact), chained left to right with ~30%
// overlap and confirmed to land inside [0,390] — see the recorded design
// pass for the derivation. Colors strictly alternate blue/red/blue/red by
// LEFT-TO-RIGHT VISUAL POSITION (each one's actual occupied range), not by
// array/generation order, so no two adjacent figures in the final rendered
// arrangement share a color.
const CLUSTER: Placement[] = [
  { x: -11, groundY: 500, scale: 2.0, flip: false, color: "var(--color-brand-blue)", opacity: 0.35 }, // occupies ~[15,127]
  { x: 241.75, groundY: 478, scale: 2.15, flip: true, color: "var(--color-brand-red)", opacity: 0.34 }, // occupies ~[93,214]
  { x: 151.03, groundY: 506, scale: 2.05, flip: false, color: "var(--color-brand-blue)", opacity: 0.36 }, // occupies ~[178,293]
  { x: 409.84, groundY: 480, scale: 2.2, flip: true, color: "var(--color-brand-red)", opacity: 0.33 }, // occupies ~[258,381]
];

// A smaller cluster for a tighter host (/welcome): measured the ACTUAL
// rendered gap on /welcome (highlights list bottom to CTA top) at a 844-tall
// viewport — 157px, not enough room for CLUSTER's 20-32%-scale figures at
// any reasonable count. 3 figures (not 4) at a reduced scale (~15-16% of an
// 844-tall reference) so the whole cluster's head-to-foot span fits inside
// that 157px band with margin on both sides — feet land ~14px above the CTA,
// heads ~9-19px below the highlights list, verified by rendering the real
// page and re-measuring, not assumed.
const CLUSTER_COMPACT: Placement[] = [
  { x: 78.1, groundY: 618, scale: 1.3, flip: false, color: "var(--color-brand-blue)", opacity: 0.32 }, // occupies ~[95,168]
  { x: 253.48, groundY: 609, scale: 1.4, flip: true, color: "var(--color-brand-red)", opacity: 0.34 }, // occupies ~[157,235]
  { x: 313.22, groundY: 618, scale: 1.3, flip: true, color: "var(--color-brand-blue)", opacity: 0.32 }, // occupies ~[224,296]
];

export function PeopleSilhouettes({
  className = "",
  variant = "full",
}: {
  className?: string;
  // "full": 4-figure cluster (for a screen with a lot of open lower space,
  // e.g. /splash). "compact": 3 smaller figures (for a screen with real
  // content lower down too, e.g. /welcome).
  variant?: "full" | "compact";
}) {
  const placements = variant === "compact" ? CLUSTER_COMPACT : CLUSTER;

  return (
    <svg
      aria-hidden
      viewBox="0 0 390 844"
      preserveAspectRatio="none"
      className={"pointer-events-none absolute inset-0 h-full w-full " + className}
    >
      {placements.map((p, i) => {
        const transform = p.flip
          ? `translate(${p.x} ${p.groundY}) scale(${-p.scale} ${p.scale})`
          : `translate(${p.x} ${p.groundY}) scale(${p.scale})`;
        return (
          <g key={i} transform={transform}>
            <SeatedFigure color={p.color} opacity={p.opacity} />
          </g>
        );
      })}
    </svg>
  );
}
