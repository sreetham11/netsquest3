import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getAccount,
  getRecentTransactions,
  getSpendingPlan,
  getRecentSpendByCategory,
  getRewards,
  getMerchantDeals,
  daysRemainingInMonth,
} from "@/lib/data/queries";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { StatCard } from "@/components/ui/StatCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { DonutChart, type DonutSegment } from "@/components/ui/DonutChart";
import { Icon } from "@/components/Icon";
import { formatMoney, formatSignedMoney, formatAmount, formatDayMonth } from "@/lib/format";
import { txnLeadingIcon, amountTone, txnValue } from "@/lib/txn";
import { PROGRAMME_NAME, POINTS_PER_DOLLAR, resolveTierProgress } from "@/lib/rewards";
import { topUp } from "../actions";

// Rank-ordered so the biggest category reads as the most confident blue,
// tapering to a neutral tonal step — matches ProgressBar/DonutChart's own
// "primary fading to neutral" convention elsewhere.
const CATEGORY_DOT_CLASSES = ["bg-primary", "bg-primary/60", "bg-outline-variant", "bg-surface-container-highest"];
const CATEGORY_STROKE_CLASSES = [
  "stroke-primary",
  "stroke-primary/60",
  "stroke-outline-variant",
  "stroke-surface-container-highest",
];

// Stitch's quick actions are Top-up / History / Auto Top-up / More — not the
// old Split/Bills/Activity row. Top-up has no dedicated route at all (it's
// the inline form below, unchanged from before) so its tile just scrolls/
// focuses that form instead of navigating.
const quickActions = [
  { href: "#topup-amount", label: "Top-up", icon: "upload" as const },
  { href: "/transactions", label: "History", icon: "transactions" as const },
  { href: "/more/auto-topup", label: "Auto Top-up", icon: "wallet" as const },
  { href: "/more", label: "More", icon: "more" as const },
];

export default async function HomePage() {
  const user = await requireUser();
  const [account, txns, plan, categorySpend, rewards, deals] = await Promise.all([
    getAccount(user.id),
    getRecentTransactions(user.id, 6),
    getSpendingPlan(user.id),
    getRecentSpendByCategory(user.id),
    // Reused, not reimplemented — the same query the Rewards page's Points
    // tab already calls, just for the Tier card's "33/50 payments" line.
    getRewards(user.id),
    // Reused too — the Marketplace tab's own query, for one featured deal.
    getMerchantDeals(),
  ]);
  const currency = account?.currency ?? "SGD";
  const perDayCents = Math.round(plan.availableCents / daysRemainingInMonth());

  const { current: currentTier, next: nextTier, progress: tierProgress, atTopTier } =
    resolveTierProgress(rewards.tiers, rewards.monthlyPaymentCount);
  const featuredDeal = deals[0];

  const sortedCategories = Object.entries(categorySpend).sort((a, b) => b[1] - a[1]);
  const topCategories = sortedCategories.slice(0, 4);
  const totalCategorySpend = sortedCategories.reduce((s, [, cents]) => s + cents, 0);
  const categorySegments: DonutSegment[] = topCategories.map(([, cents], i) => ({
    value: totalCategorySpend > 0 ? cents / totalCategorySpend : 0,
    className: CATEGORY_STROKE_CLASSES[i],
  }));

  return (
    <div>
      {/* Two-column on desktop: wallet controls (left, fixed) / stats + activity
          (right, flexible) — Stitch only designed a single mobile column, so
          this split (already established before this redesign) is kept as
          the information architecture; only each piece's own styling below
          changes. On mobile it collapses to one stacked column in DOM order. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          {/* Main Card — the one rounded-xl (24px) hero per DESIGN.md, built
              bespoke rather than through the shared Card (which is the
              smaller rounded-lg "Content Card" tier). Two-stop gradient only
              (nets-blue-gradient-start -> -end): Stitch's own CSS adds a
              third stop (#002a66) that isn't a token anywhere, so — same
              call as Phase 1's gold-gradient — left out rather than invented. */}
          <div className="relative flex min-h-[176px] flex-col justify-between rounded-xl bg-gradient-to-br from-nets-blue-gradient-start to-nets-blue-gradient-end p-6 text-on-primary shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-title-lg opacity-90">NETS Prepaid</p>
                <p className="mt-1 text-card-number opacity-80">**** 0312</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-label-md uppercase tracking-wider backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-success-green" />
                Active
              </span>
            </div>
            <div>
              <p className="mb-1 text-label-md uppercase tracking-widest opacity-70">
                Available Balance
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-title-lg font-medium opacity-90">{currency}</span>
                <span className="text-currency-display tracking-tight">
                  {formatAmount(account?.balanceCents ?? 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick actions — icon-circle over label, matching the floating
              panel under the Main Card. */}
          <Card className="grid grid-cols-4 gap-2">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="group flex flex-col items-center gap-2 rounded-lg py-1 text-center"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                  <Icon name={a.icon} size={20} />
                </span>
                <span className="text-label-md font-medium text-on-surface-variant">{a.label}</span>
              </Link>
            ))}
          </Card>

          {/* Top-up — kept as the existing working form (unchanged action/
              validation), just restyled. Its quick-action tile above scrolls
              here rather than opening a new modal flow. */}
          <form action={topUp} className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body-md text-on-surface-variant">
                $
              </span>
              <input
                id="topup-amount"
                name="amount"
                type="number"
                min="1"
                step="1"
                placeholder="Top up amount"
                className="w-full rounded-lg border border-border-light bg-surface-container-lowest py-2 pl-7 pr-3 text-body-md text-on-surface placeholder:text-on-surface-variant outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-6 text-body-lg font-semibold text-on-primary hover:bg-nets-blue-gradient-start"
            >
              Top up
            </button>
          </form>

          {/* Scan & Pay — the primary CTA, per home/screen.png. Links to
              /pay, which doesn't exist until Phase 4 — expected to 404 until
              then, same as /more since Phase 2. */}
          <Link
            href="/pay"
            className="flex min-h-14 items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-nets-blue-gradient-start to-primary text-title-lg font-bold text-on-primary shadow-card transition-opacity hover:opacity-95"
          >
            <Icon name="qr-code" size={26} />
            Scan &amp; Pay
          </Link>

          {/* Top Spending Categories — lives here (not full-width below the
              grid) so it fills the space the shorter left column otherwise
              leaves blank under the quick actions. */}
          <div>
            <h2 className="mb-3 text-title-lg text-on-surface">Top Spending Categories</h2>
            {topCategories.length === 0 ? (
              <EmptyState
                icon={<Icon name="budget" size={22} />}
                title="No spending yet"
                description="Your top categories will show up here once you start spending."
              />
            ) : (
              <Card className="flex items-center gap-6">
                <DonutChart segments={categorySegments} size={112} strokeWidth={16} />
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  {topCategories.map(([category, cents], i) => (
                    <div key={category} className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-body-md text-on-surface">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${CATEGORY_DOT_CLASSES[i]}`}
                        />
                        <span className="truncate">{category}</span>
                      </span>
                      <span className="shrink-0 text-body-md font-medium text-on-surface">
                        {formatMoney(cents, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Spending Plan, as plain stat tiles */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Available today" value={formatMoney(perDayCents, currency)} />
            <StatCard label="Planned" value={formatMoney(plan.plannedCents, currency)} />
            <StatCard label="Other spending" value={formatMoney(plan.otherCents, currency)} />
          </div>

          {/* NETS Rewards — Points + Tier cards, per home/screen.png. */}
          <div>
            <h2 className="mb-3 text-title-lg text-on-surface">NETS Rewards</h2>
            <div className="grid grid-cols-2 gap-4">
              <Card className="flex flex-col justify-between">
                <div>
                  <p className="text-label-md uppercase tracking-widest text-on-surface-variant">
                    {PROGRAMME_NAME} Balance
                  </p>
                  <p className="mt-2 text-headline-lg text-primary">
                    {rewards.points.toLocaleString()}
                  </p>
                </div>
                <Link
                  href="/rewards"
                  className="mt-4 flex items-center gap-1 text-label-md font-semibold text-primary hover:underline"
                >
                  View Rewards
                  <Icon name="chevron-right" size={14} />
                </Link>
              </Card>

              <Card className="flex flex-col justify-between border-gold-tier/40">
                <div className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-gold-tier/50 bg-gold-tier/10 px-3 py-1.5">
                  <Icon name="rewards" size={14} className="text-gold-tier" />
                  <span className="text-label-md font-bold uppercase tracking-wider text-gold-tier">
                    {currentTier?.name ?? "No tier yet"}
                  </span>
                </div>
                {nextTier ? (
                  <div>
                    <p className="mb-2 text-label-md font-medium text-on-surface-variant">
                      {rewards.monthlyPaymentCount} / {nextTier.txnCountNeeded} payments
                    </p>
                    <ProgressBar value={tierProgress} tone="gold" />
                    <p className="mt-2 text-label-md text-on-surface-variant">
                      {nextTier.txnCountNeeded - rewards.monthlyPaymentCount} more to {nextTier.name}
                    </p>
                  </div>
                ) : (
                  <p className="text-label-md text-on-surface-variant">
                    {atTopTier ? "Top tier unlocked." : "Tiers aren't set up yet."}
                  </p>
                )}
                {/* Resolved: the earn rate is a flat 1 pt/$1 (1%), independent
                    of Stitch's unconfirmed "6 points per $1" figure. Tiers DO
                    carry a small multiplier on top of this base rate (see
                    RewardTier.multiplierPercent) — shown when it's not 1x. */}
                <p className="mt-1 text-label-md font-bold text-gold-tier">
                  {POINTS_PER_DOLLAR} pt per $1 spent
                  {currentTier && currentTier.multiplierPercent !== 100
                    ? ` (${currentTier.name}: ${(currentTier.multiplierPercent / 100).toFixed(2).replace(/\.?0+$/, "")}x)`
                    : ""}
                </p>
              </Card>
            </div>
          </div>

          {/* Promo banner — Stitch labels this "Points Boost" implying a
              point multiplier, but MerchantDeal is a cashback/discount
              catalogue with no points concept at all (its `offer` field is
              free text like "10% off"); framing it as a points boost would
              be fabricating a mechanic same as the "6 pts/$1" figure above.
              Shown honestly as a merchant offer instead, using a real deal. */}
          {featuredDeal ? (
            <Link
              href="/rewards?tab=marketplace"
              className="flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-5"
            >
              <div>
                <span className="mb-2 inline-block rounded-full bg-primary px-2.5 py-1 text-label-md font-bold uppercase tracking-wider text-on-primary">
                  Merchant Offer
                </span>
                <h3 className="text-title-lg text-primary">
                  {featuredDeal.offer} at {featuredDeal.merchant}
                </h3>
                <p className="text-body-md text-on-surface-variant">
                  Pay with NETS to enjoy it.
                </p>
              </div>
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-surface-container-lowest text-primary">
                <Icon name="storefront" size={22} />
              </span>
            </Link>
          ) : null}

          {/* Recently used */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-title-lg text-on-surface">Recent Activity</h2>
              <Link href="/transactions" className="text-label-md font-semibold text-primary hover:underline">
                View All
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
                <div className="divide-y divide-border-light px-stack-md">
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
    </div>
  );
}
