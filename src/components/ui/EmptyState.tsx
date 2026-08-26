import type { ReactNode } from "react";

// Empty state — always CONTAINED in a bordered surface (never floating in blank
// space). Optional primary CTA. Icon sits in a neutral tonal circle.
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border-light bg-surface-container-lowest px-6 py-12 text-center">
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
          {icon}
        </div>
      ) : null}
      <p className="text-body-lg font-semibold text-on-surface">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-body-md text-on-surface-variant">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
