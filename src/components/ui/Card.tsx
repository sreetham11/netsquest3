import type { ReactNode } from "react";

// Neutral surface card. Grey-dominant: white surface + hairline border, never
// a blue fill (the one blue fill is the Home balance hero, handled separately).
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
        "rounded-card border border-line bg-surface " +
        (padded ? "p-8 " : "") +
        className
      }
    >
      {children}
    </div>
  );
}
