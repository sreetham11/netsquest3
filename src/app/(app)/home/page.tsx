import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getAccount,
  getRecentTransactions,
  getSpendingPlan,
  getRecentSpendByCategory,
  daysRemainingInMonth,
} from "@/lib/data/queries";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DonutChart, type DonutSegment } from "@/components/ui/DonutChart";
import { Icon } from "@/components/Icon";
import { formatMoney, formatSignedMoney, formatDayMonth } from "@/lib/format";
import { txnLeadingIcon, amountTone, txnValue } from "@/lib/txn";
import { topUp } from "../actions";

// Rank-ordered so the biggest category reads as the most confident blue,
// tapering to grey — two blue steps + two greys, no new hues introduced.
const CATEGORY_DOT_CLASSES = ["bg-accent-strong", "bg-accent", "bg-neutral-400", "bg-neutral-300"];
const CATEGORY_STROKE_CLASSES = [
  "stroke-accent-strong",
  "stroke-accent",
  "stroke-neutral-400",
  "stroke-neutral-300",
];

const quickActions = [
  { href: "/split", label: "Split", icon: "split" as const },
  { href: "/bills", label: "Bills", icon: "bills" as const },
  { href: "/transactions", label: "Activity", icon: "transactions" as const },
];

export default async function HomePage() {
  const user = await requireUser();
  const [account, txns, plan, categorySpend] = await Promise.all([
    getAccount(user.id),
    getRecentTransactions(user.id, 6),
    getSpendingPlan(user.id),
    getRecentSpendByCategory(user.id),
  ]);
  const currency = account?.currency ?? "SGD";
  const perDayCents = Math.round(plan.availableCents / daysRemainingInMonth());

  const sortedCategories = Object.entries(categorySpend).sort((a, b) => b[1] - a[1]);
  const topCategories = sortedCategories.slice(0, 4);
  const totalCategorySpend = sortedCategories.reduce((s, [, cents]) => s + cents, 0);
  const categorySegments: DonutSegment[] = topCategories.map(([, cents], i) => ({
    value: totalCategorySpend > 0 ? cents / totalCategorySpend : 0,
    className: CATEGORY_STROKE_CLASSES[i],
  }));

  return (
    <div>
      {/* Single mobile column, in the order product asked for: wallet
          controls, then stats + activity. */}
      <div className="flex flex-col gap-6">
        {/* Balance hero, restyled as a stacked wallet card — the ONE sanctioned
            blue fill in the app. Two faint duplicate outlines peek out from
            behind the bottom edge of the top card, like cards stacked in a
            wallet (they must offset DOWNWARD — an upward offset pokes out
            above "Available balance" and reads as a rendering glitch). */}
        <div className="relative mt-4">
          <div
            aria-hidden
            className="absolute inset-x-6 top-4 h-[156px] rounded-wallet bg-hero opacity-15"
          />
          <div
            aria-hidden
            className="absolute inset-x-3 top-2 h-[156px] rounded-wallet bg-hero opacity-30"
          />
          <div className="relative z-10 flex h-[156px] flex-col justify-between rounded-wallet bg-hero p-6 text-white shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-nets-blue-100">Available balance</p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatMoney(account?.balanceCents ?? 0, currency)}
                </p>
              </div>
              <Icon name="contactless" size={26} className="text-nets-blue-100" />
            </div>

            <div className="flex items-end justify-between">
              <div className="flex items-center gap-2 text-sm text-nets-blue-100">
                <Icon name="rewards" size={16} />
                {account?.rewardPoints ?? 0} reward points
              </div>
              <span className="text-sm font-bold tracking-wide text-nets-blue-100">
                NETS
              </span>
            </div>
          </div>
        </div>

        {/* Top-up — stacked so the primary CTA is a full-width, thumb-reachable
            tap target rather than a cramped inline button. */}
        <form action={topUp} className="flex flex-col gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
              $
            </span>
            <input
              name="amount"
              type="number"
              min="1"
              step="1"
              placeholder="Top up amount"
              className="w-full rounded-button border border-line bg-surface py-2 pl-7 pr-3 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent"
            />
          </div>
          <Button type="submit" className="w-full justify-center">
            Top up
          </Button>
        </form>

        {/* Quick actions — icon over label, minimal border, not boxed. Kept as
            a 3-across shortcut row (same pattern as the bottom tab nav) rather
            than stacked full-width, since these are icon-led shortcuts, not
            data/stat content. */}
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center gap-1.5 rounded-button border border-line py-3 text-xs font-medium text-ink transition-colors hover:bg-surface-muted"
            >
              <Icon name={a.icon} size={20} />
              {a.label}
            </Link>
          ))}
        </div>

        {/* Top Spending Categories — donut stacked above its legend rather
            than beside it, so category names/amounts get full card width
            instead of squeezing into the leftover space next to the chart. */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-ink">Top Spending Categories</h2>
          {topCategories.length === 0 ? (
            <EmptyState
              icon={<Icon name="budget" size={22} />}
              title="No spending yet"
              description="Your top categories will show up here once you start spending."
            />
          ) : (
            <Card className="flex flex-col items-center gap-6">
              <DonutChart segments={categorySegments} size={112} strokeWidth={16} />
              <div className="flex w-full min-w-0 flex-col gap-3">
                {topCategories.map(([category, cents], i) => (
                  <div key={category} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${CATEGORY_DOT_CLASSES[i]}`}
                      />
                      <span className="truncate">{category}</span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-ink">
                      {formatMoney(cents, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Spending Plan — stacked stat tiles instead of a 3-up row, so each
            label/value stays fully readable at mobile width. */}
        <div className="flex flex-col gap-3">
          <StatCard
            label="Available today"
            value={formatMoney(perDayCents, currency)}
          />
          <StatCard label="Planned" value={formatMoney(plan.plannedCents, currency)} />
          <StatCard
            label="Other spending"
            value={formatMoney(plan.otherCents, currency)}
          />
        </div>

        {/* Recently used */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Recently used</h2>
            <Link
              href="/transactions"
              className="text-sm font-medium text-accent hover:text-accent-strong"
            >
              Show more
            </Link>
          </div>

          {txns.length === 0 ? (
            <EmptyState
              icon={<Icon name="transactions" size={22} />}
              title="No transactions yet"
              description="Top up your wallet to get started."
            />
          ) : (
            <Card padded={false}>
              <div className="divide-y divide-line px-6">
                {txns.map((t) => (
                  <ListRow
                    key={t.id}
                    leading={<Icon name={txnLeadingIcon(t.type, t.amountCents)} size={18} />}
                    title={t.description}
                    subtitle={`${t.category} · ${formatDayMonth(t.createdAt)}`}
                    value={txnValue(t.type, t.amountCents, formatSignedMoney(t.amountCents, currency))}
                    valueTone={amountTone(t.type, t.amountCents)}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
