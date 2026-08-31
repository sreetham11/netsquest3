import Link from "next/link";
import { Icon } from "@/components/Icon";
import type { ToolItem } from "@/lib/nav";

// The Tools grid card — shared by Home's Tools section and the More page's
// own Tools grid (see TOOLS in src/lib/nav.ts) so there's one card markup,
// not two copies that can drift apart.
export function ToolCard({ tool }: { tool: ToolItem }) {
  return (
    <Link
      href={tool.href}
      className="flex flex-col gap-3 rounded-lg border border-border-light bg-surface-container-lowest p-stack-md shadow-card transition-colors hover:border-primary/20"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon name={tool.icon} size={22} />
      </span>
      <div>
        <p className="text-body-lg font-semibold text-on-surface">{tool.label}</p>
        <p className="mt-0.5 text-body-md text-on-surface-variant">{tool.description}</p>
      </div>
    </Link>
  );
}
