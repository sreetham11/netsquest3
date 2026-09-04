import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { Icon, type IconName } from "@/components/Icon";
import { NetsCredit } from "@/components/NetsCredit";

const PROFILE_LINKS: Array<{
  href: string;
  label: string;
  description: string;
  icon: IconName;
}> = [
  {
    href: "/profile/payment-methods",
    label: "Payment Methods",
    description: "Cards linked to your wallet",
    icon: "contactless",
  },
  {
    href: "/profile/security",
    label: "Security",
    description: "PIN and biometric login preferences",
    icon: "lock",
  },
];

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your account, payment methods, and security preferences." />

      <Card className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
          <Icon name="contacts" size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{user.email}</p>
          <Link
            href="/profile/edit"
            className="text-sm font-medium text-accent hover:text-accent-strong"
          >
            Edit profile
          </Link>
        </div>
      </Card>

      <div className="mt-6">
        <Card padded={false}>
          <div className="divide-y divide-line px-6">
            {PROFILE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="-mx-6 block px-6 transition-colors hover:bg-surface-muted"
              >
                <ListRow
                  leading={<Icon name={link.icon} size={18} />}
                  title={link.label}
                  subtitle={link.description}
                />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Footer credit — the real NETS mark, small and separate from any of
          this app's own CompassMark/"NETS Quest" branding elsewhere. */}
      <div className="mt-8 mb-2">
        <NetsCredit width={110} />
      </div>
    </div>
  );
}
