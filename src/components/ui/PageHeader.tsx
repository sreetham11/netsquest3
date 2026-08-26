import type { ReactNode } from "react";

// Consistent page title block. Optional right-aligned action slot (blue CTA lives
// there — red is never used for actions).
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-stack-lg flex items-start justify-between gap-4">
      <div>
        <h1 className="text-headline-lg text-on-surface">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-body-md text-on-surface-variant">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
