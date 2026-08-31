import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/auth/actions";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { ToolCard } from "@/components/ui/ToolCard";
import { Icon, type IconName } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { displayNameFromEmail } from "@/lib/user";
import { TOOLS } from "@/lib/nav";

const CARD_ROWS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/more/card-settings", label: "Card Settings", icon: "settings" },
  { href: "/more/auto-topup", label: "Auto Top-up", icon: "wallet" },
  { href: "/more/transaction-limits", label: "Transaction Limits", icon: "sliders" },
  { href: "/more/security", label: "Security & Privacy", icon: "shield" },
];

const SUPPORT_ROWS: Array<{ href: string; label: string }> = [
  { href: "/more/help", label: "Help Centre" },
  { href: "/more/contact", label: "Contact Us" },
  { href: "/more/terms", label: "Terms of Service" },
];

export default async function MorePage() {
  const user = await requireUser();
  // Only an email exists on this account (signup never collects a name or
  // phone — see AuthForm.tsx) — showing more/screen.png's "John Doe / +65
  // 9123 4567" would be fabricating fields this app never captures. Real
  // email instead of a fake phone number; display name derived from it, same
  // heuristic already used to name the "You" Split participant in seed.ts.
  const email = user.email ?? "";
  const name = displayNameFromEmail(email);

  return (
    <div className="flex flex-col gap-stack-lg">
      <Card className="flex items-center gap-4">
        <Avatar name={name} size={56} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-title-lg text-on-surface">{name}</h2>
          <p className="truncate text-body-md text-on-surface-variant">{email}</p>
        </div>
        {/* No "Edit Profile" link: there's no editable name/phone/bio field
            anywhere in this app's data model, so a link here would go
            nowhere real — omitted rather than left as a dead control. */}
      </Card>

      <section>
        <h3 className="mb-2 px-1 text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
          My NETS Card
        </h3>
        <Card padded={false}>
          <div className="divide-y divide-border-light px-stack-md">
            {CARD_ROWS.map((row) => (
              <Link key={row.href} href={row.href} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon name={row.icon} size={20} />
                  </span>
                  <span className="text-body-lg font-medium text-on-surface">{row.label}</span>
                </div>
                <Icon name="chevron-right" size={20} className="text-outline-variant" />
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <h3 className="mb-2 px-1 text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
          Appearance
        </h3>
        <Card padded={false}>
          <div className="px-stack-md">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon name="moon" size={20} />
                </span>
                <span className="text-body-lg font-medium text-on-surface">Dark Mode</span>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </Card>
      </section>

      <section>
        <h3 className="mb-2 px-1 text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
          Tools
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {TOOLS.map((tool) => (
            <ToolCard key={tool.href} tool={tool} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 px-1 text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
          Support &amp; Info
        </h3>
        <Card padded={false}>
          <div className="divide-y divide-border-light px-stack-md">
            {SUPPORT_ROWS.map((row) => (
              <Link key={row.href} href={row.href} className="flex items-center justify-between py-4">
                <span className="text-body-lg font-medium text-on-surface">{row.label}</span>
                <Icon name="chevron-right" size={20} className="text-outline-variant" />
              </Link>
            ))}
            <form action={logout}>
              <button
                type="submit"
                className="flex w-full items-center justify-center py-4 text-title-lg font-semibold text-error"
              >
                Log Out
              </button>
            </form>
          </div>
        </Card>
      </section>
    </div>
  );
}
