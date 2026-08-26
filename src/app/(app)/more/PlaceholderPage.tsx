import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/Icon";

// Shared shell for the 7 More-hub sub-pages that have no Stitch screen yet
// (My NETS Card's 4 rows + Support & Info's 3 rows). Each still gets its own
// real route file — not one dynamic [slug] page — because each is a
// genuinely distinct future feature that'll be swapped out independently as
// its own design arrives; a shared dynamic route would just need splitting
// apart again later. This component only avoids repeating the same banner/
// back-link JSX 7 times.
export function PlaceholderPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <Link
        href="/more"
        className="mb-4 inline-flex items-center gap-1 text-body-md font-medium text-primary hover:underline"
      >
        <Icon name="chevron-left" size={16} />
        More
      </Link>
      <PageHeader title={title} subtitle={description} />
      <Card className="mb-stack-md flex items-center gap-3 border-primary/20 bg-primary/5">
        <Icon name="help-circle" size={20} className="shrink-0 text-primary" />
        <p className="text-body-md text-on-surface">
          {`This is a placeholder — ${title} doesn't have its own design yet. Nothing on this page is wired up.`}
        </p>
      </Card>
      {children}
    </div>
  );
}
