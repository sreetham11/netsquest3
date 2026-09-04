"use client";

import { Icon } from "@/components/Icon";

// Plays once, before the amount screen — purely decorative, CSS-transform
// only (no real card data, no NFC/contactless claim: this is money moving
// ONTO the wallet, not a tap-to-pay action). Deliberately distinct from
// Scan & Pay's "Hold Near Reader" intro (ScanPayIntro): different icons
// (plain card + phone silhouettes, not the contactless/waves mark),
// different copy, and it plays inline on /topup itself rather than as a
// full-screen overlay before navigating — Top-up is reached via a plain
// Home tile link, not the persistent Scan & Pay nav action.
export function TopUpIntro({ onSkip }: { onSkip: () => void }) {
  return (
    <div
      role="button"
      aria-label="Skip"
      tabIndex={0}
      onClick={onSkip}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSkip();
      }}
      className="flex flex-col items-center justify-center gap-6 py-16"
    >
      <div className="relative h-16 w-44">
        {/* Fixed phone — the animation's stationary target. */}
        <span
          className="absolute top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-2xl bg-surface-muted text-accent"
          style={{ right: 0 }}
        >
          <Icon name="phone" size={26} />
        </span>
        {/* Soft ring pulsing outward once the card "arrives" (see
            --animate-topup-connect-pulse, timed to the card's arrival). */}
        <span
          className="absolute top-1/2 h-14 w-14 -translate-y-1/2 animate-topup-connect-pulse rounded-2xl border-2 border-accent"
          style={{ right: 0 }}
        />
        {/* Card — slides in from off-canvas and docks just left of the
            phone. Pure CSS transform, one-shot (see
            --animate-topup-card-slide), not looping like ScanPayIntro's. */}
        <span
          className="absolute top-1/2 flex h-10 w-14 -translate-y-1/2 animate-topup-card-slide items-center justify-center rounded-lg bg-accent text-white"
          style={{ right: 64 }}
        >
          <Icon name="card" size={20} />
        </span>
      </div>
      <p className="text-sm font-medium text-ink">Reload your NETS balance</p>
      <p className="text-xs text-ink-muted">Tap to skip</p>
    </div>
  );
}
