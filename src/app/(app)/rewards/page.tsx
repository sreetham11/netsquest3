import { requireUser } from "@/lib/auth";
import { getRewards, getMerchantDeals, getRecentSpendByCategory, getAccount } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { SegmentedProgressBar } from "@/components/ui/SegmentedProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/Icon";
import { formatDayMonth, formatMoney, formatTime } from "@/lib/format";
import {
  POINTS_PER_DOLLAR_REDEEMED,
  TIERS,
  centsFromPoints,
} from "@/lib/rewards";
import { redeemReward } from "../actions";
import { CashbackForm } from "./CashbackForm";
import { AiDealFinder } from "./AiDealFinder";

const REWARD_ICON: Record<string, IconName> = {
  coffee: "coffee",
  "bubble-tea": "bubble-tea",
  "fast-food": "fast-food",
  "movie-ticket": "movie-ticket",
  voucher: "voucher",
};

const DEAL_ICON: Record<string, IconName> = {
  food: "fast-food",
  grocery: "grocery",
  convenience: "convenience",
  cafe: "coffee",
  ride: "ride",
  pharmacy: "pharmacy",
  cinema: "movie-ticket",
};

const DEAL_CATEGORY_LABEL: Record<string, string> = {
  food: "Food court",
  grocery: "Grocery",
  convenience: "Convenience store",
  cafe: "Cafe",
  ride: "Ride-hailing",
  pharmacy: "Pharmacy & health",
  cinema: "Cinema",
};

// Gradient stops for the tier card — see globals.css "Reward tiers" section
// for why these are a scoped exception to the locked grey/blue/red palette.
// Falls back to the standard blue gradient for any tier name outside the
// known three, so an unrecognized tier never renders unstyled.
const TIER_GRADIENT: Record<string, string> = {
  Bronze: "from-tier-bronze-900 to-tier-bronze-700",
  Silver: "from-tier-silver-900 to-tier-silver-700",
  Gold: "from-tier-gold-900 to-tier-gold-700",
};
const DEFAULT_TIER_GRADIENT = "from-accent-strong to-accent";

// Maps a top-spending Transaction.category (freeform, Title Case — see
// src/lib/data/seed.ts) to the closest MerchantDeal.category, so "picked for
// you" has something to match against. Not every spend category has a
// corresponding deal category (e.g. "Shopping", "Utilities") — those just
// get no match, which is fine, it only means no reordering/badge happens.
const SPEND_CATEGORY_TO_DEAL_CATEGORY: Record<string, string> = {
  food: "food",
  groceries: "grocery",
  transport: "ride",
  entertainment: "cinema",
};

export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { tab } = await searchParams;
  const activeTab = tab === "marketplace" ? "marketplace" : "points";

  return (
    <div>
      <PageHeader
        title="Rewards"
        subtitle="Pay with NETS, earn NETS Miles automatically, and redeem something real."
      />

      <div className="mb-6 flex gap-2">
        <ButtonLink
          href="/rewards"
          variant={activeTab === "points" ? "primary" : "secondary"}
          className="flex-1 justify-center"
        >
          Miles
        </ButtonLink>
        <ButtonLink
          href="/rewards?tab=marketplace"
          variant={activeTab === "marketplace" ? "primary" : "secondary"}
          className="flex-1 justify-center"
        >
          Marketplace
        </ButtonLink>
      </div>

      {activeTab === "points" ? <PointsTab userId={user.id} /> : <MarketplaceTab userId={user.id} />}
    </div>
  );
}

async function PointsTab({ userId }: { userId: string }) {
  const {
    points,
    currency,
    currentTier,
    nextTier,
    catalogue,
    monthlyPaymentCount,
    recentRedemptions,
  } = await getRewards(userId);

  const tierProgress = nextTier
    ? (monthlyPaymentCount - currentTier.minMonthlyPayments) /
      (nextTier.minMonthlyPayments - currentTier.minMonthlyPayments)
    : 1;

  const pointsValueCents = centsFromPoints(points);

  return (
    <>
      <div className="flex flex-col gap-4">
        <Card>
          <p className="text-sm text-ink-muted">Your Miles</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{points.toLocaleString()}</p>
          <p className="mt-1 text-sm text-ink-muted">
            Worth {formatMoney(pointsValueCents, currency)} ·{" "}
            {POINTS_PER_DOLLAR_REDEEMED} Miles = $1.00
          </p>
        </Card>

        {/* Card-styled block with a gradient matching the tier — bronze,
            silver, gold, richer/more premium at each step up. Hand-rolled
            rather than the shared Card (which locks in a white surface +
            grey border, wrong for a colored fill) — same reasoning as the
            Home balance card's gradient hero. */}
        <div
          className={
            "rounded-card bg-gradient-to-br p-6 text-white shadow-sm " +
            (TIER_GRADIENT[currentTier.name] ?? DEFAULT_TIER_GRADIENT)
          }
        >
          <p className="text-sm text-white/75">Your tier</p>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white">
            <Icon name="rewards" size={14} />
            {currentTier.name} · {currentTier.multiplier}x
          </div>

          {nextTier ? (
            <div className="mt-5">
              {/* 10 discrete blocks rather than one continuous fill — a
                  fixed-scale gauge (this month's progress toward the NEXT
                  tier), not a literal 1-block-per-payment count: Silver's
                  own gap to Gold is 15 payments, not 10, so segments are
                  proportional (same tierProgress ratio the old bar used),
                  not payment count directly. tone="white" instead of the
                  default accent blue, which would clash with a bronze/gold
                  background. */}
              <SegmentedProgressBar value={tierProgress} segments={10} tone="white" />
              <p className="mt-1.5 text-xs text-white/75">
                {monthlyPaymentCount}/{nextTier.minMonthlyPayments} payments this month for{" "}
                {nextTier.name} — {nextTier.minMonthlyPayments - monthlyPaymentCount} more at{" "}
                {nextTier.multiplier}x
              </p>
            </div>
          ) : (
            <p className="mt-5 text-sm text-white/75">
              Top tier unlocked — earning {currentTier.multiplier}x on every NETS payment.
            </p>
          )}
          <p className="mt-3 text-xs text-white/60">
            Only payments of $1.00 or more count toward your monthly tally.
          </p>
        </div>
      </div>

      {/* The two redemption paths, as separate explicit actions. */}
      <div className="mt-8">
        <h2 className="mb-3 text-xl font-bold text-ink">Use your Miles</h2>
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
                <Icon name="bills" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">Apply at checkout</p>
                <p className="text-sm text-ink-muted">
                  Knock up to 50% off a bill payment with Miles.
                </p>
              </div>
            </div>
            <ButtonLink href="/bills" className="mt-4 w-full justify-center">
              Go to Bills
            </ButtonLink>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
                <Icon name="voucher" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">Redeem for cashback</p>
                <p className="text-sm text-ink-muted">
                  Convert Miles straight into your wallet balance.
                </p>
              </div>
            </div>
            <CashbackForm
              pointsBalance={points}
              pointsPerDollar={POINTS_PER_DOLLAR_REDEEMED}
            />
          </Card>
        </div>
      </div>

      {/* Tiers reward how OFTEN you choose NETS, not how much you spend. */}
      <div className="mt-8">
        <h2 className="mb-3 text-xl font-bold text-ink">All tiers</h2>
        <Card padded={false}>
          <div className="divide-y divide-line px-6">
            {TIERS.map((tier) => {
              const unlocked = monthlyPaymentCount >= tier.minMonthlyPayments;
              return (
                <ListRow
                  key={tier.name}
                  leading={<Icon name="rewards" size={16} />}
                  title={`${tier.name} · ${tier.multiplier}x`}
                  subtitle={tier.perk}
                  subtitleWrap
                  value={unlocked ? "Unlocked" : `${tier.minMonthlyPayments}+ payments/mo`}
                  valueTone={unlocked ? "positive" : "neutral"}
                />
              );
            })}
          </div>
        </Card>
      </div>

      {/* Tangible rewards read as more motivating than an equivalent cashback %. */}
      <div className="mt-8">
        <h2 className="mb-3 text-xl font-bold text-ink">Redeem your Miles</h2>
        {catalogue.length === 0 ? (
          <EmptyState
            icon={<Icon name="rewards" size={22} />}
            title="No rewards available"
            description="Check back soon for redeemable rewards."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {catalogue.map((reward) => {
              const affordable = points >= reward.pointCost;
              return (
                <Card key={reward.id} padded={false} className="flex flex-col gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
                      <Icon name={REWARD_ICON[reward.category] ?? "rewards"} size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{reward.name}</p>
                      <p className="mt-0.5 text-sm text-ink-muted">
                        {reward.pointCost.toLocaleString()} Miles
                      </p>
                    </div>
                  </div>
                  <form action={redeemReward}>
                    <input type="hidden" name="rewardId" value={reward.id} />
                    <Button type="submit" disabled={!affordable} className="w-full justify-center">
                      Redeem
                    </Button>
                  </form>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Persisted confirmation — a real DB row, so it survives a reload. */}
      <div className="mt-8">
        <h2 className="mb-3 text-xl font-bold text-ink">Recently redeemed</h2>
        {recentRedemptions.length === 0 ? (
          <EmptyState
            icon={<Icon name="rewards" size={22} />}
            title="No redemptions yet"
            description="Redeem a reward above and it'll show up here."
          />
        ) : (
          <Card padded={false}>
            <div className="divide-y divide-line px-6">
              {recentRedemptions.map((r) => (
                <ListRow
                  key={r.id}
                  leading={<Icon name={REWARD_ICON[r.reward.category] ?? "rewards"} size={18} />}
                  title={r.reward.name}
                  subtitle={`${formatDayMonth(r.createdAt)} · ${formatTime(r.createdAt)}`}
                  value={`-${r.pointsSpent.toLocaleString()} Miles`}
                  valueTone="negative"
                />
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

async function MarketplaceTab({ userId }: { userId: string }) {
  const [deals, categorySpend, account] = await Promise.all([
    getMerchantDeals(),
    getRecentSpendByCategory(userId),
    getAccount(userId),
  ]);

  const topSpendCategory = Object.entries(categorySpend).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topDealCategory = topSpendCategory
    ? SPEND_CATEGORY_TO_DEAL_CATEGORY[topSpendCategory.toLowerCase()]
    : undefined;

  // Matching deals float to the top; sort is stable, so within each group
  // (matching / not) the original catalogue order is preserved.
  const sortedDeals = topDealCategory
    ? [...deals].sort((a, b) => Number(b.category === topDealCategory) - Number(a.category === topDealCategory))
    : deals;

  return (
    <div>
      {/* Open-ended AI discovery + mock checkout, distinct from the curated
          partner-deal list below — clearly separated so it reads as
          "search anything" rather than another row in the fixed merchant
          catalogue. */}
      <AiDealFinder
        balanceCents={account?.balanceCents ?? 0}
        currency={account?.currency ?? "SGD"}
      />

      <p className="mb-1 text-sm text-ink-muted">
        Exclusive discounts from partner merchants — pay with NETS to enjoy them.
      </p>
      {topDealCategory ? (
        <p className="mb-4 text-xs text-ink-muted">
          Top matches are sorted first, based on your spending.
        </p>
      ) : null}
      {deals.length === 0 ? (
        <EmptyState
          icon={<Icon name="rewards" size={22} />}
          title="No active deals"
          description="Check back soon for merchant offers."
        />
      ) : (
        <Card padded={false}>
          <div className="divide-y divide-line px-6">
            {sortedDeals.map((deal) => {
              const pickedForYou = deal.category === topDealCategory;
              return (
                <ListRow
                  key={deal.id}
                  leading={<Icon name={DEAL_ICON[deal.category] ?? "rewards"} size={18} />}
                  title={deal.merchant}
                  subtitle={DEAL_CATEGORY_LABEL[deal.category] ?? deal.category}
                  value={
                    // A pill, not plain colored text — same treatment as the
                    // "Picked for you" badge below, so the discount reads as
                    // a distinct callout instead of blending into the row.
                    <span className="inline-block rounded-full bg-nets-blue-100 px-2.5 py-1 text-xs font-semibold text-accent">
                      {deal.offer}
                    </span>
                  }
                  badge={
                    pickedForYou ? (
                      <span className="rounded-full bg-nets-blue-100 px-2 py-0.5 text-xs font-medium text-accent">
                        Picked for you
                      </span>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
