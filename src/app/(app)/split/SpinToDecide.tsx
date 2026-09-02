"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import {
  alreadySpun as isAlreadySpun,
  canSpin,
  payerOf,
  type SpinParticipant,
  type SpinSplit,
} from "@/lib/split";
import { spinSplit, type SpinResult } from "../actions";

const SPIN_MS = 3000;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// One spin, one outcome: who fronts the bill. A split spun once stays spun —
// re-opening shows the stored result rather than offering another spin.
export function SpinToDecide({
  splitId,
  split,
  participants,
}: {
  splitId: string;
  split: SpinSplit;
  participants: SpinParticipant[];
}) {
  const spun = isAlreadySpun(split);
  const storedPayer = payerOf(split, participants);
  const sliceDeg = participants.length > 0 ? 360 / participants.length : 360;

  // If this split was already spun, park the wheel with the stored payer under
  // the pointer so the persisted result is what you see on load.
  const storedIndex = storedPayer
    ? participants.findIndex((p) => p.id === storedPayer.id)
    : -1;
  const initialRotation =
    storedIndex >= 0 ? (360 - (storedIndex * sliceDeg + sliceDeg / 2) + 360) % 360 : 0;

  const [open, setOpen] = useState(false);
  const [rotation, setRotation] = useState(initialRotation);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [revealed, setRevealed] = useState(spun);
  const [spinError, setSpinError] = useState("");

  const spinAllowed = canSpin(split, participants);

  // Equal slices, alternating the two brand colors. Every slice is the same
  // size and weight — nothing marks one as better than another.
  //
  // Two colors cannot alternate around a ring with an ODD number of slices:
  // the last slice wraps into the first and both land on blue. So for odd
  // counts of 3+, the wrap-around slice takes deep-navy instead, which keeps
  // every neighbour pair distinct. (n=1 has no neighbour, so it stays blue.)
  const oddWrapIndex =
    participants.length >= 3 && participants.length % 2 === 1
      ? participants.length - 1
      : -1;
  const gradient = `conic-gradient(${participants
    .map((_, i) => {
      const color =
        i === oddWrapIndex
          ? "var(--color-deep-navy)"
          : i % 2 === 0
            ? "var(--color-brand-blue)"
            : "var(--color-brand-red)";
      return `${color} ${i * sliceDeg}deg ${(i + 1) * sliceDeg}deg`;
    })
    .join(", ")})`;

  // Name shown in the result: the fresh spin's, else the stored one.
  const payerName = result?.ok ? result.payerName : (storedPayer?.name ?? null);

  async function handleSpin() {
    if (spinning || !spinAllowed) return;
    setSpinError("");
    setSpinning(true);
    setRevealed(false);

    // The SERVER picks the winner; the wheel only animates to what it returns.
    const res = await spinSplit(splitId);
    if (!res.ok) {
      setSpinError(res.error);
      setSpinning(false);
      return;
    }
    setResult(res);

    const index = participants.findIndex((p) => p.id === res.payerParticipantId);
    const centerDeg = index * sliceDeg + sliceDeg / 2;
    const current = ((rotation % 360) + 360) % 360;
    const needed = (360 - centerDeg) % 360;
    const delta = (needed - current + 360) % 360;
    setRotation(rotation + 360 * 5 + delta);
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
        className="mt-4 w-full justify-center"
      >
        <Icon name="split" size={16} />
        {spun ? "View spin result" : "Spin to Decide"}
      </Button>
    );
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Spin to Decide</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-ink-muted hover:text-ink"
        >
          Close
        </button>
      </div>

      <p className="mt-1 text-xs text-ink-muted">
        The wheel picks who fronts the bill. Everyone still owes their own share
        back — the split itself doesn&apos;t change.
      </p>

      <div className="mt-4 flex flex-col items-center">
        <div className="relative flex h-[224px] w-[224px] items-center justify-center">
          {/* Pointer — sits ON TOP of the wheel: larger, solid deep-navy, with
              its own shadow so it never blends into the page behind it. */}
          <div
            aria-hidden
            className="absolute -top-1 z-20 h-0 w-0 border-x-[11px] border-t-[18px] border-x-transparent border-t-deep-navy drop-shadow-md"
          />

          {/* The wheel. White outer ring + soft drop shadow lift it off the
              page so it reads as an object rather than a flat pie chart. */}
          <div
            onTransitionEnd={() => {
              setSpinning(false);
              setRevealed(true);
            }}
            className="relative h-[196px] w-[196px] rounded-full border-[3px] border-white shadow-lg"
            style={{
              background: gradient,
              transform: `rotate(${rotation}deg)`,
              transition: `transform ${SPIN_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
            }}
          >
            {/* Hairline divider on every slice boundary. Two colors can't
                alternate around an ODD number of slices without one seam
                where the last meets the first — these keep that seam reading
                as two distinct slices instead of one merged wedge. */}
            {participants.length > 1
              ? participants.map((p, i) => (
                  <span
                    key={`divider-${p.id}`}
                    aria-hidden
                    className="absolute left-1/2 top-1/2 h-1/2 w-[2px] bg-white/70"
                    style={{
                      transformOrigin: "top center",
                      transform: `translateX(-50%) rotate(${i * sliceDeg - 180}deg)`,
                    }}
                  />
                ))
              : null}

            {participants.map((p, i) => {
              const centerDeg = i * sliceDeg + sliceDeg / 2;
              // Counter-rotate by the wheel's rotation as well as the slice
              // angle, so each label rides its slice but stays upright rather
              // than ending upside-down. Same transition to stay in sync.
              const label =
                participants.length > 6 || p.name.length > 9
                  ? initialsOf(p.name)
                  : p.name;
              return (
                <span
                  key={p.id}
                  className="absolute left-1/2 top-1/2 max-w-[56px] truncate text-xs font-semibold text-white"
                  style={{
                    transform: `rotate(${centerDeg}deg) translateY(-64px) rotate(${-centerDeg - rotation}deg) translate(-50%, -50%)`,
                    transition: `transform ${SPIN_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
                    // Keeps names legible on both the blue and the red slices.
                    textShadow: "0 1px 2px rgb(0 0 0 / 0.45)",
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>

          {/* Center hub — deliberately OUTSIDE the rotating element so it
              stays still while the wheel turns. Echoes the splash compass. */}
          <div
            aria-hidden
            className="absolute z-10 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-deep-navy shadow-md"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M10 3 L13 10 L10 8.6 Z" fill="var(--color-brand-red)" />
              <path d="M10 3 L7 10 L10 8.6 Z" fill="#ffffff" fillOpacity="0.9" />
              <path d="M10 17 L7 10 L10 11.4 Z" fill="var(--color-brand-blue)" />
              <path d="M10 17 L13 10 L10 11.4 Z" fill="#ffffff" fillOpacity="0.35" />
            </svg>
          </div>
        </div>

        {spinError ? (
          <p className="mt-3 text-sm text-danger-strong">{spinError}</p>
        ) : null}

        {/* Spun once, spun for good — no re-spin control after a result. */}
        {/* Same primary Button as everywhere else in the app; full width,
            directly below the wheel. */}
        {!spun ? (
          <Button
            type="button"
            onClick={handleSpin}
            disabled={!spinAllowed || spinning}
            className="mt-6 w-full justify-center"
          >
            {spinning ? "Spinning…" : "Spin"}
          </Button>
        ) : null}

        {revealed && payerName ? (
          <div className="mt-4 w-full rounded-button border border-line bg-surface-muted p-3">
            <p className="text-sm font-medium text-ink">
              {payerName} fronts the bill — everyone else owes {payerName} their
              share.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
