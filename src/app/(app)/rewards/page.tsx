import { requireUser } from "@/lib/auth";
import { getRewards, getMerchantDeals } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { ProgressBar } from "@/components/ui/ProgressBar";
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
        subtitle="Pay with NETS, earn points automatically, and redeem something real."
      />

      <div className="mb-6 flex gap-2">
        <ButtonLink
          href="/rewards"
          variant={activeTab === "points" ? "primary" : "secondary"}
          className="flex-1 justify-center"
        >
          Points
        </ButtonLink>
        <ButtonLink
          href="/rewards?tab=marketplace"
          variant={activeTab === "marketplace" ? "primary" : "secondary"}
          className="flex-1 justify-center"
        >
          Marketplace
        </ButtonLink>
      </div>

      {activeTab === "points" ? <PointsTab userId={user.id} /> : <MarketplaceTab />}
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
            {POINTS_PER_DOLLAR_REDEEMED} pts = $1.00
          </p>
        </Card>

        <Card>
          <p className="text-sm text-ink-muted">Your tier</p>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-nets-blue-100 px-3 py-1 text-sm font-medium text-accent">
            <Icon name="rewards" size={14} />
            {currentTier.name} · {currentTier.multiplier}x
          </div>

          {nextTier ? (
            <div className="mt-5">
              <ProgressBar value={tierProgress} />
              <p className="mt-1.5 text-xs text-ink-muted">
                {monthlyPaymentCount}/{nextTier.minMonthlyPayments} payments this month for{" "}
                {nextTier.name} — {nextTier.minMonthlyPayments - monthlyPaymentCount} more at{" "}
                {nextTier.multiplier}x
              </p>
            </div>
          ) : (
            <p className="mt-5 text-sm text-ink-muted">
              Top tier unlocked — earning {currentTier.multiplier}x on every NETS payment.
            </p>
          )}
          <p className="mt-3 text-xs text-ink-muted">
            Only payments of $1.00 or more count toward your monthly tally.
          </p>
        </Card>
      </div>

      {/* The two redemption paths, as separate explicit actions. */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-ink">Use your Miles</h2>
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
                <Icon name="arrow-down" size={18} />
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
        <h2 className="mb-3 text-lg font-semibold text-ink">All tiers</h2>
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
        <h2 className="mb-3 text-lg font-semibold text-ink">Redeem your points</h2>
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
                        {reward.pointCost.toLocaleString()} pts
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
        <h2 className="mb-3 text-lg font-semibold text-ink">Recently redeemed</h2>
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
                  value={`-${r.pointsSpent.toLocaleString()} pts`}
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

async function MarketplaceTab() {
  const deals = await getMerchantDeals();

  return (
    <div>
      <p className="mb-4 text-sm text-ink-muted">
        Exclusive discounts from partner merchants — pay with NETS to enjoy them.
      </p>
      {deals.length === 0 ? (
        <EmptyState
          icon={<Icon name="rewards" size={22} />}
          title="No active deals"
          description="Check back soon for merchant offers."
        />
      ) : (
        <Card padded={false}>
          <div className="divide-y divide-line px-6">
            {deals.map((deal) => (
              <ListRow
                key={deal.id}
                leading={<Icon name={DEAL_ICON[deal.category] ?? "rewards"} size={18} />}
                title={deal.merchant}
                subtitle={DEAL_CATEGORY_LABEL[deal.category] ?? deal.category}
                value={deal.offer}
                valueTone="positive"
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
