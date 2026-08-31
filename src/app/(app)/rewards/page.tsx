import { requireUser } from "@/lib/auth";
import { getRewards, getMerchantDealsRankedForUser } from "@/lib/data/queries";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/Icon";
import { formatDayMonth, formatTime, formatMoney } from "@/lib/format";
import { categoryIcon } from "@/lib/categoryIcon";
import { PROGRAMME_NAME, POINTS_PER_DOLLAR, cashbackCentsForPoints, resolveTierProgress } from "@/lib/rewards";
import { RedeemButton } from "./RedeemButton";

const REWARD_ICON: Record<string, IconName> = {
  coffee: "coffee",
  "bubble-tea": "bubble-tea",
  "fast-food": "fast-food",
  "movie-ticket": "movie-ticket",
  voucher: "voucher",
  cashback: "wallet",
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
      {/* nets_rewards/screen.png's in-content title is primary blue, unlike
          the shared PageHeader's neutral on-surface title — PageHeader is
          still used by not-yet-redesigned pages, so this is a one-off
          heading here rather than a change to that shared component. */}
      <h1 className="mb-6 text-headline-lg text-primary">{PROGRAMME_NAME}</h1>

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

      {activeTab === "points" ? <PointsTab userId={user.id} /> : <MarketplaceTab userId={user.id} />}
    </div>
  );
}

async function PointsTab({ userId }: { userId: string }) {
  // Every number below is derived from this one freshly-fetched read. The page
  // is dynamic (requireUser reads cookies), and every action that moves points
  // revalidates /rewards, so the balance, the tier and the distance-to-next
  // reward can't disagree with each other or lag a redemption. getRewards()
  // also sweeps expired points (12-month expiry) as part of this same read.
  const { points, tiers, catalogue, monthlyPaymentCount, recentRedemptions, recentPointEvents, expiringSoon } =
    await getRewards(userId);

  const {
    ordered: orderedTiers,
    current: currentTier,
    next: nextTier,
    progress: tierProgress,
    atTopTier,
  } = resolveTierProgress(tiers, monthlyPaymentCount);
  const currentIndex = currentTier ? orderedTiers.findIndex((t) => t.id === currentTier.id) : -1;

  // Always show exact distance to the next reward, not an abstract balance —
  // pick the cheapest catalogue item the user hasn't reached yet.
  const nextReward = catalogue.find((r) => r.pointCost > points);
  const rewardProgress = nextReward ? points / nextReward.pointCost : 1;

  return (
    <>
      {/* Status card — combines what nets_rewards/screen.png shows as one
          card: points balance, current tier pill, and progress to next tier. */}
      <Card className="relative overflow-hidden border-gold-tier/30">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-body-md text-on-surface-variant">Available {PROGRAMME_NAME}</p>
            <p className="mt-1 text-currency-display text-primary">
              {points.toLocaleString()} <span className="text-body-md font-medium">pts</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-surface-container-lowest px-3 py-1.5">
              <Icon name="rewards" size={16} className="text-gold-tier" />
              <span className="text-label-md font-semibold text-on-surface">
                {currentTier?.name ?? "No tier yet"}
              </span>
            </div>
            {/* Resolved: the earn rate is a flat 1 pt/$1 (1%), independent of
                Stitch's unconfirmed "6 pts/$1" figure — that question is
                closed. What DOES vary by tier is a small earn-rate
                multiplier on top of this base rate (see below), not a
                replacement for it. */}
            <p className="text-label-md text-on-surface-variant">
              {POINTS_PER_DOLLAR} pt / $1{" "}
              {currentTier && currentTier.multiplierPercent !== 100
                ? `× ${(currentTier.multiplierPercent / 100).toFixed(2).replace(/\.?0+$/, "")}`
                : ""}
            </p>
          </div>
        </div>

        {nextTier ? (
          <div className="space-y-3 rounded-lg border border-border-light/50 bg-surface-container-low p-4">
            <div className="flex justify-between text-label-md">
              <span className="font-medium text-on-surface">{nextTier.name} Progress</span>
              <span className="font-semibold text-primary">
                {monthlyPaymentCount} / {nextTier.txnCountNeeded}
              </span>
            </div>
            <ProgressBar value={tierProgress} />
            <p className="text-label-md text-on-surface-variant">
              {nextTier.txnCountNeeded - monthlyPaymentCount} more qualifying payments to unlock
            </p>
          </div>
        ) : (
          <p className="text-body-md text-on-surface-variant">
            {atTopTier ? "Top tier unlocked — enjoy the perks below." : "Tiers aren't set up on this account yet."}
          </p>
        )}
      </Card>

      {/* Policy note (always shown) + a specific heads-up when something is
          actually about to expire — see getRewards's expiringSoon. */}
      <p className="mt-3 text-label-md text-on-surface-variant">
        {PROGRAMME_NAME} expire 12 months after they&apos;re earned.
        {expiringSoon
          ? ` ${expiringSoon.points.toLocaleString()} pts expire on ${formatDayMonth(expiringSoon.earliestExpiresAt)} — redeem them before then.`
          : ""}
      </p>

      {/* Principle 1, visible progress: show WHICH payments earned the points,
          not just the total. Not part of the Stitch reference — kept from
          this system's own earn-history requirement, just reskinned. Reads
          the ACTUAL awarded amount from PointLot, not a recompute off the
          transaction amount — with a tier multiplier, those can differ. */}
      <div className="mt-8">
        <h2 className="mb-3 text-title-lg text-on-surface">Recent points earned</h2>
        {recentPointEvents.length === 0 ? (
          <EmptyState
            icon={<Icon name="rewards" size={22} />}
            title="No points earned yet"
            description={`Pay with NETS and you'll earn ${PROGRAMME_NAME} automatically — S$1 = ${POINTS_PER_DOLLAR} pt, on payments of $2 or more.`}
          />
        ) : (
          <Card padded={false}>
            <div className="divide-y divide-border-light px-stack-md">
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

      {/* Loyalty Tiers — bento grid per nets_rewards/screen.png. Range labels
          ("X-Y payments") are derived from the real seeded thresholds, not
          copied from the screen's example numbers. Tier names now match the
          Stitch reference exactly ("Member" for the entry tier) — the task
          that resized these thresholds also renamed Bronze -> Member, which
          happens to resolve the naming mismatch flagged in an earlier pass. */}
      <div className="mt-8">
        <h2 className="mb-3 text-title-lg text-on-surface">Loyalty Tiers</h2>
        <div className="grid grid-cols-2 gap-3">
          {orderedTiers.map((tier, i) => {
            const isCurrent = i === currentIndex;
            const isFuture = currentIndex !== -1 && i > currentIndex;
            const upper = orderedTiers[i + 1];
            const range = upper ? `${tier.txnCountNeeded}-${upper.txnCountNeeded - 1}` : `${tier.txnCountNeeded}+`;
            return (
              <div
                key={tier.id}
                className={
                  "relative flex h-28 flex-col justify-between rounded-lg border p-5 " +
                  (isCurrent
                    ? "border-2 border-gold-tier bg-gold-tier/5"
                    : "border-border-light bg-surface-container-lowest") +
                  (isFuture ? " opacity-60" : "")
                }
              >
                {isCurrent ? (
                  <Icon name="check-circle" size={20} className="absolute right-3 top-3 text-gold-tier" />
                ) : null}
                <div>
                  <p
                    className={
                      "text-body-lg font-semibold " + (isCurrent ? "text-gold-tier" : "text-on-surface")
                    }
                  >
                    {tier.name}
                  </p>
                  <p className="mt-0.5 text-label-md text-on-surface-variant">{tier.perk}</p>
                </div>
                <p className="text-label-md text-on-surface-variant">{range} payments</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Reward — same nextReward/rewardProgress this tab already
          computed, restyled to the icon-box + progress-bar row Stitch uses. */}
      {nextReward ? (
        <div className="mt-8">
          <Card className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border-light bg-surface-container-low text-primary">
              <Icon name={REWARD_ICON[nextReward.category] ?? "rewards"} size={26} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-label-md uppercase tracking-wider text-on-surface-variant">
                Next Reward
              </p>
              <p className="text-title-lg text-on-surface">{nextReward.name}</p>
              <div className="mt-2">
                <ProgressBar value={rewardProgress} size="lg" />
                <p className="mt-1 text-right text-label-md text-on-surface-variant">
                  {points.toLocaleString()} / {nextReward.pointCost.toLocaleString()} pts
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Tangible rewards read as more motivating than an equivalent cashback %
          — except cashback itself, which is deliberately plain: it's the
          "just give me the honest rate in cash" option, not a persuasion play. */}
      <div className="mt-8">
        <h2 className="mb-3 text-title-lg text-on-surface">Redeem Rewards</h2>
        {catalogue.length === 0 ? (
          <EmptyState
            icon={<Icon name="rewards" size={22} />}
            title="No rewards available"
            description="Check back soon for redeemable rewards."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {catalogue.map((reward) => {
              const affordable = points >= reward.pointCost;
              const isCashback = reward.category === "cashback";
              return (
                <Card
                  key={reward.id}
                  className={"flex items-center gap-4" + (affordable ? "" : " opacity-70")}
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border-light bg-surface-container-low text-primary">
                    <Icon name={REWARD_ICON[reward.category] ?? "rewards"} size={26} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-lg font-semibold text-on-surface">{reward.name}</p>
                    <p className="mt-0.5 text-body-md font-medium text-primary">
                      {reward.pointCost.toLocaleString()} pts
                      {isCashback ? ` → ${formatMoney(cashbackCentsForPoints(reward.pointCost))} credited` : ""}
                    </p>
                  </div>
                  <div className="w-32 shrink-0">
                    <RedeemButton rewardId={reward.id} affordable={affordable} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Persisted confirmation — a real DB row, so it survives a reload. */}
      <div className="mt-8">
        <h2 className="mb-3 text-title-lg text-on-surface">Recently redeemed</h2>
        {recentRedemptions.length === 0 ? (
          <EmptyState
            icon={<Icon name="rewards" size={22} />}
            title="No redemptions yet"
            description="Redeem a reward above and it'll show up here."
          />
        ) : (
          <Card padded={false}>
            <div className="divide-y divide-border-light px-stack-md">
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

async function MarketplaceTab({ userId }: { userId: string }) {
  // Reordered by relevance to this user's own real spending — see
  // getMerchantDealsRankedForUser. Never hides a deal, only reorders; with
  // no spending history it's identical to the original catalogue order.
  const deals = await getMerchantDealsRankedForUser(userId);

  return (
    <div>
      {/* Matches nets_rewards/screen.png's "Merchant Boosts" section — the
          closest analog to a merchant marketplace in that reference. Same
          underlying deal data as before, just restyled to that section's
          row treatment (icon box + name + offer chip + chevron) instead of
          the old ListRow-with-value layout. */}
      <p className="mb-4 text-body-md text-on-surface-variant">
        Exclusive discounts from partner merchants — pay with NETS to enjoy them.
      </p>
      {deals.length === 0 ? (
        <EmptyState
          icon={<Icon name="rewards" size={22} />}
          title="No active deals"
          description="Check back soon for merchant offers."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {deals.map((deal) => (
            <Card key={deal.id} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border-light text-primary">
                  <Icon name={DEAL_ICON[deal.category] ?? "storefront"} size={20} />
                </span>
                <div>
                  <p className="text-body-lg font-semibold text-on-surface">{deal.merchant}</p>
                  <span className="mt-1 inline-block rounded-full bg-success-green/10 px-2 py-0.5 text-label-md font-semibold text-success-green">
                    {deal.offer}
                  </span>
                </div>
              </div>
              <Icon name="chevron-right" size={20} className="shrink-0 text-outline" />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
