// Mirrors src/app/(app)/rewards/page.tsx — Points + Marketplace tabs, real
// resolveTierProgress (pure). Uses a searchParam tab switch exactly like the
// real page, just against /preview/rewards instead.
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Icon, type IconName } from "@/components/Icon";
import { POINTS_PER_DOLLAR, resolveTierProgress } from "@/lib/rewards";
import { PreviewRedeemButton } from "./PreviewRedeemButton";

const REWARD_ICON: Record<string, IconName> = {
  coffee: "coffee", "bubble-tea": "bubble-tea", "fast-food": "fast-food",
  "movie-ticket": "movie-ticket", voucher: "voucher",
};
const DEAL_ICON: Record<string, IconName> = {
  food: "fast-food", grocery: "grocery", convenience: "convenience",
  cafe: "coffee", ride: "ride", pharmacy: "pharmacy", cinema: "movie-ticket",
};

const mockPoints = 1240;
const mockTiers = [
  { id: "1", name: "Bronze", txnCountNeeded: 0 },
  { id: "2", name: "Silver", txnCountNeeded: 20 },
  { id: "3", name: "Gold", txnCountNeeded: 50 },
  { id: "4", name: "Platinum", txnCountNeeded: 100 },
];
const mockMonthlyPaymentCount = 33;
const mockCatalogue = [
  { id: "1", name: "Coffee", pointCost: 500, category: "coffee" },
  { id: "2", name: "Bubble Tea", pointCost: 800, category: "bubble-tea" },
  { id: "3", name: "Movie Ticket", pointCost: 3000, category: "movie-ticket" },
];
const mockPointEvents = [
  { id: "1", description: "Kopitiam", when: "27 Aug · 1:29 PM", points: 24 },
  { id: "2", description: "FairPrice", when: "27 Aug · 11:15 AM", points: 118 },
];
const mockRedemptions = [{ id: "1", name: "Coffee", category: "coffee", pointsSpent: 500, when: "25 Aug · 9:00 AM" }];
const mockDeals = [
  { id: "1", merchant: "Koufu", category: "food", offer: "10% off" },
  { id: "2", merchant: "Cheers", category: "convenience", offer: "5% cashback" },
];

export default async function PreviewRewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "marketplace" ? "marketplace" : "points";

  const { ordered: orderedTiers, current: currentTier, next: nextTier, progress: tierProgress } =
    resolveTierProgress(mockTiers, mockMonthlyPaymentCount);
  const currentIndex = currentTier ? orderedTiers.findIndex((t) => t.id === currentTier.id) : -1;
  const nextReward = mockCatalogue.find((r) => r.pointCost > mockPoints);
  const rewardProgress = nextReward ? mockPoints / nextReward.pointCost : 1;

  return (
    <div>
      <h1 className="mb-6 text-headline-lg text-primary">Rewards</h1>
      <div className="mb-6 flex gap-2">
        <ButtonLink href="/preview/rewards" variant={activeTab === "points" ? "primary" : "secondary"} className="flex-1 justify-center">Points</ButtonLink>
        <ButtonLink href="/preview/rewards?tab=marketplace" variant={activeTab === "marketplace" ? "primary" : "secondary"} className="flex-1 justify-center">Marketplace</ButtonLink>
      </div>

      {activeTab === "points" ? (
        <>
          <Card className="relative overflow-hidden border-gold-tier/30">
            <div className="mb-8 flex items-start justify-between">
              <div>
                <p className="text-body-md text-on-surface-variant">Available Points</p>
                <p className="mt-1 text-currency-display text-primary">{mockPoints.toLocaleString()} <span className="text-body-md font-medium">pts</span></p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-surface-container-lowest px-3 py-1.5">
                  <Icon name="rewards" size={16} className="text-gold-tier" />
                  <span className="text-label-md font-semibold text-on-surface">{currentTier?.name}</span>
                </div>
                <p className="text-label-md text-on-surface-variant">{POINTS_PER_DOLLAR} pts / $1 spent</p>
              </div>
            </div>
            {nextTier ? (
              <div className="space-y-3 rounded-lg border border-border-light/50 bg-surface-container-low p-4">
                <div className="flex justify-between text-label-md">
                  <span className="font-medium text-on-surface">{nextTier.name} Progress</span>
                  <span className="font-semibold text-primary">{mockMonthlyPaymentCount} / {nextTier.txnCountNeeded}</span>
                </div>
                <ProgressBar value={tierProgress} />
                <p className="text-label-md text-on-surface-variant">{nextTier.txnCountNeeded - mockMonthlyPaymentCount} more qualifying payments to unlock</p>
              </div>
            ) : null}
          </Card>

          <div className="mt-8">
            <h2 className="mb-3 text-title-lg text-on-surface">Recent points earned</h2>
            <Card padded={false}>
              <div className="divide-y divide-border-light px-stack-md">
                {mockPointEvents.map((e) => (
                  <ListRow key={e.id} leading={<Icon name="fast-food" size={18} />} title={e.description} subtitle={e.when} value={`+${e.points} pts`} valueTone="positive" />
                ))}
              </div>
            </Card>
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-title-lg text-on-surface">Loyalty Tiers</h2>
            <div className="grid grid-cols-2 gap-3">
              {orderedTiers.map((tier, i) => {
                const isCurrent = i === currentIndex;
                const isFuture = currentIndex !== -1 && i > currentIndex;
                const upper = orderedTiers[i + 1];
                const range = upper ? `${tier.txnCountNeeded}-${upper.txnCountNeeded - 1}` : `${tier.txnCountNeeded}+`;
                return (
                  <div key={tier.id} className={"relative flex h-28 flex-col justify-between rounded-lg border p-5 " + (isCurrent ? "border-2 border-gold-tier bg-gold-tier/5" : "border-border-light bg-surface-container-lowest") + (isFuture ? " opacity-60" : "")}>
                    {isCurrent ? <Icon name="check-circle" size={20} className="absolute right-3 top-3 text-gold-tier" /> : null}
                    <p className={"text-body-lg font-semibold " + (isCurrent ? "text-gold-tier" : "text-on-surface")}>{tier.name}</p>
                    <p className="text-label-md text-on-surface-variant">{range} payments</p>
                  </div>
                );
              })}
            </div>
          </div>

          {nextReward ? (
            <div className="mt-8">
              <Card className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border-light bg-surface-container-low text-primary">
                  <Icon name={REWARD_ICON[nextReward.category] ?? "rewards"} size={26} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-label-md uppercase tracking-wider text-on-surface-variant">Next Reward</p>
                  <p className="text-title-lg text-on-surface">{nextReward.name}</p>
                  <div className="mt-2">
                    <ProgressBar value={rewardProgress} size="lg" />
                    <p className="mt-1 text-right text-label-md text-on-surface-variant">{mockPoints.toLocaleString()} / {nextReward.pointCost.toLocaleString()} pts</p>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          <div className="mt-8">
            <h2 className="mb-3 text-title-lg text-on-surface">Redeem Rewards</h2>
            <div className="flex flex-col gap-3">
              {mockCatalogue.map((reward) => {
                const affordable = mockPoints >= reward.pointCost;
                return (
                  <Card key={reward.id} className={"flex items-center gap-4" + (affordable ? "" : " opacity-70")}>
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border-light bg-surface-container-low text-primary">
                      <Icon name={REWARD_ICON[reward.category] ?? "rewards"} size={26} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-lg font-semibold text-on-surface">{reward.name}</p>
                      <p className="mt-0.5 text-body-md font-medium text-primary">{reward.pointCost.toLocaleString()} pts</p>
                    </div>
                    <div className="w-32 shrink-0">
                      <PreviewRedeemButton affordable={affordable} />
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-title-lg text-on-surface">Recently redeemed</h2>
            <Card padded={false}>
              <div className="divide-y divide-border-light px-stack-md">
                {mockRedemptions.map((r) => (
                  <ListRow key={r.id} leading={<Icon name={REWARD_ICON[r.category] ?? "rewards"} size={18} />} title={r.name} subtitle={r.when} value={`-${r.pointsSpent} pts`} valueTone="negative" />
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : (
        <div>
          <p className="mb-4 text-body-md text-on-surface-variant">Exclusive discounts from partner merchants — pay with NETS to enjoy them.</p>
          <div className="flex flex-col gap-3">
            {mockDeals.map((deal) => (
              <Card key={deal.id} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border-light text-primary">
                    <Icon name={DEAL_ICON[deal.category] ?? "storefront"} size={20} />
                  </span>
                  <div>
                    <p className="text-body-lg font-semibold text-on-surface">{deal.merchant}</p>
                    <span className="mt-1 inline-block rounded-full bg-success-green/10 px-2 py-0.5 text-label-md font-semibold text-success-green">{deal.offer}</span>
                  </div>
                </div>
                <Icon name="chevron-right" size={20} className="shrink-0 text-outline" />
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
