import type { ReactNode } from "react";

// Content Card (DESIGN.md): white surface, 16px internal padding, rounded-lg
// (16px) corners, one soft ambient shadow — never a heavy drop-shadow, never
// stacked shadows. This is the generic/default card tier; the Home hero
// balance card is the ONE "Main Card" (rounded-xl/24px) and is built as its
// own bespoke markup rather than through this component, same as before.
export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border border-border-light bg-surface-container-lowest shadow-card " +
        (padded ? "p-stack-md " : "") +
        className
      }
    >
      {children}
    </div>
  );
}
