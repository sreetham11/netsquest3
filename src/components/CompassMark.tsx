"use client";

import { useId } from "react";

// The NETS Quest compass mark — a gradient ring with a north-pointing needle
// picking up the brand red/blue. Shared by the splash screen and the auth
// screens so the identity is drawn once, not duplicated per screen.
//
// The gradient needs a document-unique id, hence useId: two instances on one
// page would otherwise collide on the same <linearGradient id>.
// `sheen` adds a glossy highlight arc over the ring. It is OPT-IN and off by
// default so the splash and welcome screens keep the exact mark they had.
export function CompassMark({
  size = 96,
  sheen = false,
}: {
  size?: number;
  sheen?: boolean;
}) {
  const gradientId = useId();
  const sheenId = `${gradientId}-sheen`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="96" y2="96">
          <stop offset="0%" stopColor="var(--color-brand-red)" />
          <stop offset="100%" stopColor="var(--color-brand-blue)" />
        </linearGradient>
        {sheen ? (
          // Light-to-transparent sweep, laid over one arc of the ring to fake a
          // glossy highlight — pure SVG, no image.
          <linearGradient id={sheenId} x1="0" y1="0" x2="96" y2="96">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        ) : null}
      </defs>

      <circle cx="48" cy="48" r="42" stroke={`url(#${gradientId})`} strokeWidth="4" />

      {sheen ? (
        // ~90 degrees of the 264-unit circumference, rotated to the upper-left.
        <circle
          cx="48"
          cy="48"
          r="42"
          stroke={`url(#${sheenId})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="66 198"
          transform="rotate(-135 48 48)"
        />
      ) : null}
      <circle
        cx="48"
        cy="48"
        r="33"
        stroke="currentColor"
        strokeWidth="1"
        className="text-white/20"
      />

      {/* Needle — north half red, south half blue */}
      <path d="M48 20 L58 48 L48 44 Z" fill="var(--color-brand-red)" />
      <path d="M48 76 L38 48 L48 52 Z" fill="var(--color-brand-blue)" />
      <path d="M48 20 L38 48 L48 44 Z" fill="#ffffff" fillOpacity="0.85" />
      <path d="M48 76 L58 48 L48 52 Z" fill="#ffffff" fillOpacity="0.35" />

      <circle cx="48" cy="48" r="3.5" fill="#ffffff" />
    </svg>
  );
}
