import { requireUser } from "@/lib/auth";
import { getAccount, getOverseasTransactions } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { ListRow } from "@/components/ui/ListRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/Icon";
import { formatMoney, formatSignedMoney, formatDayMonth } from "@/lib/format";

// Static demo content, not a live merchant/maps API — consistent with the
// "7-Eleven Bangkok" overseas transaction already in the seed data.
const NEARBY_MERCHANTS: Array<{ name: string; category: string; distance: string; icon: IconName }> = [
  { name: "Chatuchak Weekend Market", category: "Market", distance: "0.6 km", icon: "grocery" },
  { name: "FamilyMart Bangkok", category: "Convenience store", distance: "0.2 km", icon: "convenience" },
  { name: "7-Eleven Bangkok", category: "Convenience store", distance: "0.3 km", icon: "convenience" },
  { name: "Terminal 21 Food Court", category: "Food court", distance: "0.9 km", icon: "fast-food" },
];

// Merchant pin coordinates on the 400x180 illustration below, one per entry
// in NEARBY_MERCHANTS (same order).
const PIN_POSITIONS = [
  { x: 60, y: 40 },
  { x: 140, y: 148 },
  { x: 250, y: 46 },
  { x: 330, y: 102 },
];

export default async function OverseasPage() {
  const user = await requireUser();
  const [account, txns] = await Promise.all([
    getAccount(user.id),
    getOverseasTransactions(user.id),
  ]);
  const currency = account?.currency ?? "SGD";

  const totalSpent = txns.reduce((s, t) => s + Math.abs(t.amountCents), 0);
  const countries = new Set(txns.map((t) => t.country).filter(Boolean));

  return (
    <div>
      <PageHeader
        title="Overseas"
        subtitle="Foreign-currency spend, converted to SGD at settlement."
      />

      {txns.length === 0 ? (
        <EmptyState
          icon={<Icon name="overseas" size={22} />}
          title="No overseas spend yet"
          description="Payments made abroad will show here with the local and SGD amounts."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Spent overseas" value={formatMoney(totalSpent, currency)} tone="negative" />
            <StatCard label="Countries" value={String(countries.size)} hint="This wallet" />
          </div>

          <div className="mt-8">
            <Card padded={false}>
              <div className="divide-y divide-line px-6">
                {txns.map((t) => (
                  <ListRow
                    key={t.id}
                    leading={<Icon name="overseas" size={18} />}
                    title={t.description}
                    subtitle={`${t.country} · ${formatDayMonth(t.createdAt)}`}
                    value={formatSignedMoney(t.amountCents, currency)}
                    valueTone="negative"
                    valueHint={
                      t.currencyLocal && t.amountLocalCents != null
                        ? formatMoney(t.amountLocalCents, t.currencyLocal)
                        : undefined
                    }
                  />
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Static/illustrative — not a live merchant or maps API. */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-ink">Nearby merchants</h2>
        <Card padded={false} className="overflow-hidden">
          <svg
            viewBox="0 0 400 180"
            className="block w-full"
            role="img"
            aria-label="Stylized map of Bangkok showing your location and nearby merchants"
          >
            <rect width="400" height="180" className="fill-surface-muted" />
            <g className="stroke-line" strokeWidth={2} fill="none">
              <path d="M0 58H400" />
              <path d="M0 128H400" />
              <path d="M92 0V180" />
              <path d="M262 0V180" />
            </g>
            <g className="fill-line">
              <rect x="18" y="14" width="50" height="30" rx="4" />
              <rect x="118" y="10" width="60" height="34" rx="4" />
              <rect x="198" y="14" width="42" height="30" rx="4" />
              <rect x="298" y="10" width="70" height="34" rx="4" />
              <rect x="18" y="78" width="50" height="36" rx="4" />
              <rect x="118" y="74" width="110" height="40" rx="4" />
              <rect x="278" y="78" width="52" height="36" rx="4" />
              <rect x="18" y="144" width="60" height="26" rx="4" />
              <rect x="150" y="144" width="80" height="26" rx="4" />
              <rect x="290" y="144" width="70" height="26" rx="4" />
            </g>

            {/* "You are here" */}
            <circle cx="200" cy="94" r="13" className="fill-accent/15" />
            <circle cx="200" cy="94" r="5" className="fill-accent-strong" />

            {/* One pin per NEARBY_MERCHANTS entry, same order as PIN_POSITIONS. */}
            {PIN_POSITIONS.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="7" className="fill-surface" />
                <circle cx={p.x} cy={p.y} r="5" className="fill-accent" />
              </g>
            ))}
          </svg>
          <div className="flex items-center gap-2 border-t border-line px-6 py-4">
            <Icon name="pin" size={16} className="shrink-0 text-ink-muted" />
            <div>
              <p className="text-sm font-medium text-ink">Bangkok, Thailand</p>
              <p className="text-xs text-ink-muted">Illustrative map — merchant locations are approximate.</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <Card padded={false}>
          <div className="divide-y divide-line px-6">
            {NEARBY_MERCHANTS.map((m) => (
              <ListRow
                key={m.name}
                leading={<Icon name={m.icon} size={18} />}
                title={m.name}
                subtitle={m.category}
                value={m.distance}
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
