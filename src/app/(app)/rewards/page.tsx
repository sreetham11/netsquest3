import { requireUser } from "@/lib/auth";
import { getRewards, getMerchantDeals } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/Icon";
import { formatDayMonth, formatTime } from "@/lib/format";
import { categoryIcon } from "@/lib/categoryIcon";
import { POINTS_PER_DOLLAR, resolveTierProgress } from "@/lib/rewards";
import { RedeemButton } from "./RedeemButton";

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
  // Every number below is derived from this one freshly-fetched read. The page
  // is dynamic (requireUser reads cookies), and every action that moves points
  // revalidates /rewards, so the balance, the tier and the distance-to-next
  // reward can't disagree with each other or lag a redemption.
  const { points, tiers, catalogue, monthlyPaymentCount, recentRedemptions, recentPointEvents } =
    await getRewards(userId);

  const {
    ordered: orderedTiers,
    current: currentTier,
    next: nextTier,
    progress: tierProgress,
    atTopTier,
  } = resolveTierProgress(tiers, monthlyPaymentCount);

  // Always show exact distance to the next reward, not an abstract balance —
  // pick the cheapest catalogue item the user hasn't reached yet.
  const nextReward = catalogue.find((r) => r.pointCost > points);
  const rewardProgress = nextReward ? points / nextReward.pointCost : 1;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-ink-muted">Your points</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{points.toLocaleString()}</p>

          {nextReward ? (
            <div className="mt-5">
              <ProgressBar value={rewardProgress} />
              <p className="mt-1.5 text-xs text-ink-muted">
                {points.toLocaleString()}/{nextReward.pointCost.toLocaleString()} pts —{" "}
                {(nextReward.pointCost - points).toLocaleString()} more until {nextReward.name}
              </p>
            </div>
          ) : (
            <p className="mt-5 text-sm text-ink-muted">
              You have enough points to redeem anything in the catalogue.
            </p>
          )}
        </Card>

        <Card>
          <p className="text-sm text-ink-muted">Your tier</p>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-nets-blue-100 px-3 py-1 text-sm font-medium text-accent">
            <Icon name="rewards" size={14} />
            {/* With tiers seeded, a zero-payment user still resolves to the
                entry tier (threshold 0). The fallback only shows when no tier
                is reachable at all — better honest than a hardcoded "Bronze"
                the account hasn't actually earned. */}
            {currentTier?.name ?? "No tier yet"}
          </div>

          {nextTier ? (
            <div className="mt-5">
              <ProgressBar value={tierProgress} />
              <p className="mt-1.5 text-xs text-ink-muted">
                {monthlyPaymentCount}/{nextTier.txnCountNeeded} NETS payments this month —{" "}
                {nextTier.txnCountNeeded - monthlyPaymentCount} more to {nextTier.name}
              </p>
            </div>
          ) : atTopTier ? (
            <p className="mt-5 text-sm text-ink-muted">
              Top tier unlocked — enjoy the perks below.
            </p>
          ) : (
            // No tiers configured at all. Without this branch an empty tier list
            // falls through to "Top tier unlocked", which is the opposite of true.
            <p className="mt-5 text-sm text-ink-muted">
              Tiers aren&apos;t set up on this account yet.
            </p>
          )}
        </Card>
      </div>

      {/* Principle 1, visible progress: show WHICH payments earned the points,
          not just the total. Rendered straight off the Transaction rows — no
          separate points ledger to fall out of sync. */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-ink">Recent points earned</h2>
        {recentPointEvents.length === 0 ? (
          <EmptyState
            icon={<Icon name="rewards" size={22} />}
            title="No points earned yet"
            description={`Pay with NETS and you'll earn ${POINTS_PER_DOLLAR} points for every S$1 — automatically.`}
          />
        ) : (
          <Card padded={false}>
            <div className="divide-y divide-line px-6">
              {recentPointEvents.map((event) => (
                <ListRow
                  key={event.id}
                  leading={<Icon name={categoryIcon(event.category)} size={18} />}
                  title={event.description}
                  subtitle={`${formatDayMonth(event.createdAt)} · ${formatTime(event.createdAt)}`}
                  value={`+${event.points.toLocaleString()} pts`}
                  valueTone="positive"
                />
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Tiers reward how OFTEN you choose NETS, not how much you spend. */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-ink">All tiers</h2>
        <Card padded={false}>
          <div className="divide-y divide-line px-6">
            {orderedTiers.map((tier) => {
              const unlocked = monthlyPaymentCount >= tier.txnCountNeeded;
              return (
                <ListRow
                  key={tier.id}
                  leading={<Icon name="rewards" size={16} />}
                  title={tier.name}
                  subtitle={tier.perk}
                  value={unlocked ? "Unlocked" : `${tier.txnCountNeeded}+ payments/mo`}
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {catalogue.map((reward) => {
              const affordable = points >= reward.pointCost;
              return (
                <Card key={reward.id} className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
                    <Icon name={REWARD_ICON[reward.category] ?? "rewards"} size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{reward.name}</p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {reward.pointCost.toLocaleString()} pts
                    </p>
                  </div>
                  <RedeemButton rewardId={reward.id} affordable={affordable} />
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
