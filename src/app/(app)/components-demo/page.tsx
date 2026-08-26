// Phase 1 test page — exercises all five shared components with realistic
// placeholder content. Not linked in nav; used to visually verify the library.
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { formatSignedMoney } from "@/lib/format";

const activity = [
  { title: "Kopitiam", subtitle: "Food · 24 Jul", amount: -480 },
  { title: "Salary", subtitle: "Income · 25 Jul", amount: 320000 },
  { title: "Grab", subtitle: "Transport · 23 Jul", amount: -1450 },
];

export default function ComponentsDemoPage() {
  return (
    <div>
      <PageHeader
        title="Component library"
        subtitle="Phase 1 — shared components on the app shell"
        action={
          <Button>
            <Icon name="plus" size={18} />
            Primary CTA
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Balance" value="$1,240.00" hint="Available" />
        <StatCard label="This month" value="$820.50" hint="Spent so far" />
        <StatCard
          label="Overspend"
          value="-$45.00"
          hint="Dining budget"
          tone="negative"
        />
      </div>

      <div className="mt-6">
        <Card padded={false}>
          <div className="border-b border-line px-6 py-4">
            <h2 className="text-lg font-semibold text-ink">Recent activity</h2>
          </div>
          <div className="divide-y divide-line px-6">
            {activity.map((row) => (
              <ListRow
                key={row.title}
                leading={<Icon name="transactions" size={18} />}
                title={row.title}
                subtitle={row.subtitle}
                value={formatSignedMoney(row.amount)}
                valueTone={row.amount < 0 ? "negative" : "positive"}
              />
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <EmptyState
          icon={<Icon name="split" size={22} />}
          title="No splits yet."
          description="Someone's about to owe you money. Start a split to keep track."
          action={
            <ButtonLink href="/split" variant="primary">
              Start a split
            </ButtonLink>
          }
        />
      </div>
    </div>
  );
}
