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
import { EmptyState } from "@/components/ui/EmptyState";
import { DonutChart, type DonutSegment } from "@/components/ui/DonutChart";
import { Icon } from "@/components/Icon";
import { formatMoney, formatSignedMoney, formatDayMonth } from "@/lib/format";
import { txnLeadingIcon, amountTone, txnValue, splitHref } from "@/lib/txn";

// Keyed by category NAME (categoryIcon.ts's fixed taxonomy), not by rank
// index — a category's color is then fixed/stable (Food is always orange,
// Transport is always blue, ...) rather than shifting if its spend rank
// relative to other categories changes between page loads. Six fully
// independent chart-only hues (see globals.css) — none of them reuse
// --color-accent, so no slot can fall back to the app's own navy-ish brand
// blue and read as "still dark" the way the first pass at this did.
const CATEGORY_CHART_COLOR: Record<string, { dot: string; stroke: string }> = {
  Food: { dot: "bg-chart-orange", stroke: "stroke-chart-orange" },
  Groceries: { dot: "bg-chart-teal", stroke: "stroke-chart-teal" },
  Shopping: { dot: "bg-chart-purple", stroke: "stroke-chart-purple" },
  Transport: { dot: "bg-chart-blue", stroke: "stroke-chart-blue" },
  Entertainment: { dot: "bg-chart-pink", stroke: "stroke-chart-pink" },
  Utilities: { dot: "bg-chart-green", stroke: "stroke-chart-green" },
};
// Anything outside the known taxonomy (shouldn't happen in practice) still
// gets a real, visible color rather than silently rendering blank.
const FALLBACK_CHART_COLOR = { dot: "bg-neutral-400", stroke: "stroke-neutral-400" };

function chartColorFor(category: string) {
  return CATEGORY_CHART_COLOR[category] ?? FALLBACK_CHART_COLOR;
}

// Shortcuts to routes that are NOT flush tabs in the bottom nav — Home,
// Activity and Rewards already have permanent tabs, so putting them here too
// is a duplicate entry point. None of these five live in the More sheet
// either (see src/lib/nav.ts) — this row is each one's ONLY entry point,
// so there's zero overlap between Home and More in either direction.
const quickActions = [
  { href: "/split", label: "Split", icon: "split" as const },
  { href: "/bills", label: "Bills", icon: "bills" as const },
  { href: "/budget", label: "Budget", icon: "budget" as const },
  { href: "/topup", label: "Top up", icon: "plus" as const },
  { href: "/auto-topup", label: "Auto Top-up", icon: "settings" as const },
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
  const categorySegments: DonutSegment[] = topCategories.map(([category, cents]) => ({
    value: totalCategorySpend > 0 ? cents / totalCategorySpend : 0,
    className: chartColorFor(category).stroke,
  }));

  return (
    <div>
      {/* Single mobile column, in the order product asked for: wallet
          controls, then stats + activity. */}
      <div className="flex flex-col gap-6">
        {/* Balance card — laid out like a real card face rather than a data
            panel: product label + balance top-left, contactless mark
            top-right, NETS wordmark bottom-right where a network logo sits.
            Depth comes from a soft top-to-bottom navy gradient (blue-900 ->
            blue-700, both locked tokens — no new hue; vertical rather than a
            diagonal corner-to-corner cut, so it reads as a subtle sheen
            rather than a bold two-tone split) plus a drop shadow, and the
            two faint duplicates behind it read as cards stacked in a wallet
            (they must offset DOWNWARD — an upward offset pokes out above the
            label and reads as a rendering glitch). Radius is the dedicated
            --radius-wallet token (20px, Home-card-only per globals.css) —
            slightly softer than the standard --radius-card (12px) used
            everywhere else, for a more modern card feel.

            Deliberately NO masked "•••• 0312" line: Account holds only a
            balance, currency and points — there is no card/PAN data, and
            deriving digits from an internal id would fake a credential.

            Height is a compromise: 358x188 (~1.9:1) is visibly card-shaped
            without a true 1.6:1 card (~226px) eating the mobile fold.
            Reward points sit BELOW the face as a secondary line. */}
        <div className="mt-4">
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-x-6 top-4 h-[188px] rounded-wallet bg-hero opacity-15"
            />
            <div
              aria-hidden
              className="absolute inset-x-3 top-2 h-[188px] rounded-wallet bg-hero opacity-30"
            />
            <div className="relative z-10 flex h-[188px] flex-col justify-between rounded-wallet bg-gradient-to-b from-hero to-accent p-6 text-white shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-nets-blue-100">
                    NETS Prepaid
                  </p>
                  <p className="mt-4 text-sm text-nets-blue-100">Available balance</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {formatMoney(account?.balanceCents ?? 0, currency)}
                  </p>
                  {/* Supporting line, not a second focal point: lighter
                      weight + smaller size than the balance figure above it,
                      and translucent rather than solid white. mt-1.5 (not a
                      bigger gap) keeps it visually grouped with the balance
                      it's commenting on, and text-xs is the smallest step on
                      the locked type scale, so this can't grow to compete —
                      the fixed 188px card height has enough slack in the
                      existing p-6 padding to fit it without crowding the
                      NETS wordmark anchored at the bottom via justify-between. */}
                  <p className="mt-1.5 text-xs font-normal text-white/75">
                    Tap. Earn. Repeat.
                  </p>
                </div>
                {/* Slightly larger + labeled so this doesn't read as a wifi/
                    signal icon out of context — it's the same arcs-from-a-dot
                    glyph either way, the label is what disambiguates it. */}
                <div className="flex flex-col items-center gap-1">
                  <Icon name="contactless" size={30} className="text-nets-blue-100" />
                  <span className="text-xs font-medium tracking-wide text-nets-blue-100">
                    Contactless
                  </span>
                </div>
              </div>

              {/* Network mark, bottom-right — the card-logo position. */}
              <div className="flex items-end justify-end">
                <span className="text-lg font-bold tracking-wide text-white">NETS</span>
              </div>
            </div>
          </div>

          {/* mt-6 clears the stacked duplicates behind the card (they peek out
              up to 16px below its bottom edge) — a tighter gap makes this line
              overlap them and read as a rendering artifact. */}
          <div className="mt-6 flex items-center gap-2 text-sm text-ink-muted">
            <Icon name="rewards" size={16} className="text-accent" />
            <span className="font-medium text-ink">{account?.rewardPoints ?? 0}</span>
            reward points
          </div>
        </div>

        {/* Quick actions — icon over label, minimal border, not boxed, same
            pattern as the bottom tab nav. 2 columns rather than 3: with 5
            tiles, 3-across leaves a dangling empty cell in row 2 (2 of 3
            filled); 2-across divides evenly except for one odd tile out,
            which spans the full row below instead of sitting in a half-empty
            row — no gap either way, and wider tiles at 2-across besides.
            Top-up moved here (see quickActions comment) — no more embedded
            $-input-and-button permanently on Home. */}
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((a, i) => {
            const isLastOdd = quickActions.length % 2 === 1 && i === quickActions.length - 1;
            return (
              <Link
                key={a.href}
                href={a.href}
                className={
                  "flex flex-col items-center gap-1.5 rounded-button border border-line py-3 text-xs font-medium text-ink transition-colors hover:bg-surface-muted " +
                  (isLastOdd ? "col-span-2" : "")
                }
              >
                <Icon name={a.icon} size={20} />
                {a.label}
              </Link>
            );
          })}
        </div>

        {/* Top Spending Categories — donut stacked above its legend rather
            than beside it, so category names/amounts get full card width
            instead of squeezing into the leftover space next to the chart. */}
        <div>
          <h2 className="mb-3 text-xl font-bold text-ink">Top Spending Categories</h2>
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
                {topCategories.map(([category, cents]) => (
                  <div key={category} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${chartColorFor(category).dot}`}
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
            <h2 className="text-xl font-bold text-ink">Recently used</h2>
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
                {txns.map((t) => {
                  const splitLink = splitHref(t.description, t.amountCents);
                  return (
                    <ListRow
                      key={t.id}
                      leading={<Icon name={txnLeadingIcon(t.type, t.amountCents, t.category)} size={18} />}
                      title={t.description}
                      subtitle={`${t.category} · ${formatDayMonth(t.createdAt)}`}
                      value={txnValue(t.type, t.amountCents, formatSignedMoney(t.amountCents, currency))}
                      valueTone={amountTone(t.type, t.amountCents)}
                      actions={
                        splitLink ? (
                          <Link
                            href={splitLink}
                            aria-label={`Split ${t.description}`}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-accent"
                          >
                            <Icon name="split" size={16} />
                          </Link>
                        ) : undefined
                      }
                    />
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
