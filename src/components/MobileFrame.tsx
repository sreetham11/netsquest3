import type { ReactNode } from "react";

// THE single source of truth for the app's phone-frame geometry and styling.
// Every screen — authenticated pages (via AppShell) and the auth pages
// (login/signup, via AuthForm) — renders inside this, so there is exactly one
// place that defines width, height, border, shadow, and rounding.
//
// Fixed device frame: exactly 390px wide and exactly one viewport tall
// (h-dvh), centered, never growing with content. The page body cannot scroll
// (overflow-hidden here); scrolling belongs to a flex-1 overflow-y-auto region
// INSIDE the frame, so all four borders always stay on screen and every route
// renders at an identical frame size.
//
// Children are laid out as a flex column filling the frame.
export function MobileFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh w-full justify-center overflow-hidden bg-canvas">
      {/* `relative` so overlays (e.g. the nav's More sheet) can position
          against the frame instead of the whole viewport. Purely a
          positioning context — it changes no geometry. */}
      <div className="relative flex h-full w-full max-w-[390px] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-sm">
        {children}
      </div>
    </div>
  );
}
