// Mirrors src/app/(app)/home/page.tsx's structure — real ui/* components,
// real Icon set, real format/rewards helpers (none of which touch prisma or
// supabase) — with hardcoded mock data standing in for
// getAccount/getRecentTransactions/getSpendingPlan/getRecentSpendByCategory/
// getRewards/getMerchantDeals.
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { StatCard } from "@/components/ui/StatCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DonutChart, type DonutSegment } from "@/components/ui/DonutChart";
import { Icon } from "@/components/Icon";
import { formatMoney, formatAmount } from "@/lib/format";
import { POINTS_PER_DOLLAR, resolveTierProgress } from "@/lib/rewards";

const CATEGORY_DOT_CLASSES = ["bg-primary", "bg-primary/60", "bg-outline-variant", "bg-surface-container-highest"];
const CATEGORY_STROKE_CLASSES = ["stroke-primary", "stroke-primary/60", "stroke-outline-variant", "stroke-surface-container-highest"];

const mockAccount = { balanceCents: 8400, currency: "SGD", rewardPoints: 1240 };
const mockTxns = [
  { id: "1", description: "Kopitiam", category: "Food", amountCents: -840, type: "PAYMENT" },
  { id: "2", description: "FairPrice", category: "Groceries", amountCents: -2360, type: "PAYMENT" },
  { id: "3", description: "Top-up", category: "Top-up", amountCents: 2000, type: "TOPUP" },
];
const mockPlan = { plannedCents: 4590, otherCents: 3100, availableCents: 7631 };
const mockCategorySpend: Record<string, number> = { Food: 12400, Groceries: 18200, Transport: 4600, Shopping: 7300 };
const mockTiers = [
  { id: "1", name: "Bronze", txnCountNeeded: 0 },
  { id: "2", name: "Silver", txnCountNeeded: 20 },
  { id: "3", name: "Gold", txnCountNeeded: 50 },
  { id: "4", name: "Platinum", txnCountNeeded: 100 },
];
const mockMonthlyPaymentCount = 33;
const mockDeal = { merchant: "Koufu", offer: "10% off" };

const quickActions = [
  { href: "/preview/pay", label: "Top-up", icon: "upload" as const },
  { href: "/preview/activity", label: "History", icon: "transactions" as const },
  { href: "/preview/more", label: "Auto Top-up", icon: "wallet" as const },
  { href: "/preview/more", label: "More", icon: "more" as const },
];

export default function PreviewHomePage() {
  const { current: currentTier, next: nextTier, progress: tierProgress } = resolveTierProgress(
    mockTiers,
    mockMonthlyPaymentCount,
  );

  const sortedCategories = Object.entries(mockCategorySpend).sort((a, b) => b[1] - a[1]);
  const topCategories = sortedCategories.slice(0, 4);
  const totalCategorySpend = sortedCategories.reduce((s, [, c]) => s + c, 0);
  const categorySegments: DonutSegment[] = topCategories.map(([, cents], i) => ({
    value: totalCategorySpend > 0 ? cents / totalCategorySpend : 0,
    className: CATEGORY_STROKE_CLASSES[i],
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
      <div className="flex flex-col gap-6">
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
            <p className="mb-1 text-label-md uppercase tracking-widest opacity-70">Available Balance</p>
            <div className="flex items-baseline gap-2">
              <span className="text-title-lg font-medium opacity-90">{mockAccount.currency}</span>
              <span className="text-currency-display tracking-tight">{formatAmount(mockAccount.balanceCents)}</span>
            </div>
          </div>
        </div>

        <Card className="grid grid-cols-4 gap-2">
          {quickActions.map((a) => (
            <Link key={a.label} href={a.href} className="group flex flex-col items-center gap-2 rounded-lg py-1 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                <Icon name={a.icon} size={20} />
              </span>
              <span className="text-label-md font-medium text-on-surface-variant">{a.label}</span>
            </Link>
          ))}
        </Card>

        <Link
          href="/preview/pay"
          className="flex min-h-14 items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-nets-blue-gradient-start to-primary text-title-lg font-bold text-on-primary shadow-card"
        >
          <Icon name="qr-code" size={26} />
          Scan &amp; Pay
        </Link>

        <div>
          <h2 className="mb-3 text-title-lg text-on-surface">Top Spending Categories</h2>
          <Card className="flex items-center gap-6">
            <DonutChart segments={categorySegments} size={112} strokeWidth={16} />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {topCategories.map(([category, cents], i) => (
                <div key={category} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-body-md text-on-surface">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CATEGORY_DOT_CLASSES[i]}`} />
                    <span className="truncate">{category}</span>
                  </span>
                  <span className="shrink-0 text-body-md font-medium text-on-surface">{formatMoney(cents)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Available today" value={formatMoney(Math.round(mockPlan.availableCents / 20))} />
          <StatCard label="Planned" value={formatMoney(mockPlan.plannedCents)} />
          <StatCard label="Other spending" value={formatMoney(mockPlan.otherCents)} />
        </div>

        <div>
          <h2 className="mb-3 text-title-lg text-on-surface">NETS Rewards</h2>
          <div className="grid grid-cols-2 gap-4">
            <Card className="flex flex-col justify-between">
              <div>
                <p className="text-label-md uppercase tracking-widest text-on-surface-variant">Points Balance</p>
                <p className="mt-2 text-headline-lg text-primary">{mockAccount.rewardPoints.toLocaleString()}</p>
              </div>
              <Link href="/preview/rewards" className="mt-4 flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
                View Rewards
                <Icon name="chevron-right" size={14} />
              </Link>
            </Card>
            <Card className="flex flex-col justify-between border-gold-tier/40">
              <div className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-gold-tier/50 bg-gold-tier/10 px-3 py-1.5">
                <Icon name="rewards" size={14} className="text-gold-tier" />
                <span className="text-label-md font-bold uppercase tracking-wider text-gold-tier">{currentTier?.name}</span>
              </div>
              <div>
                <p className="mb-2 text-label-md font-medium text-on-surface-variant">
                  {mockMonthlyPaymentCount} / {nextTier?.txnCountNeeded} payments
                </p>
                <ProgressBar value={tierProgress} tone="gold" />
                <p className="mt-2 text-label-md text-on-surface-variant">
                  {nextTier ? `${nextTier.txnCountNeeded - mockMonthlyPaymentCount} more to ${nextTier.name}` : "Top tier unlocked"}
                </p>
              </div>
              <p className="mt-1 text-label-md font-bold text-gold-tier">{POINTS_PER_DOLLAR} points per $1 spent</p>
            </Card>
          </div>
        </div>

        <Link href="/preview/rewards" className="flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-5">
          <div>
            <span className="mb-2 inline-block rounded-full bg-primary px-2.5 py-1 text-label-md font-bold uppercase tracking-wider text-on-primary">
              Merchant Offer
            </span>
            <h3 className="text-title-lg text-primary">{mockDeal.offer} at {mockDeal.merchant}</h3>
            <p className="text-body-md text-on-surface-variant">Pay with NETS to enjoy it.</p>
          </div>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-surface-container-lowest text-primary">
            <Icon name="storefront" size={22} />
          </span>
        </Link>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-title-lg text-on-surface">Recent Activity</h2>
            <Link href="/preview/activity" className="text-label-md font-semibold text-primary hover:underline">View All</Link>
          </div>
          <Card padded={false}>
            <div className="divide-y divide-border-light px-stack-md">
              {mockTxns.map((t) => (
                <ListRow
                  key={t.id}
                  leading={<Icon name={t.amountCents > 0 ? "arrow-down" : "arrow-up"} size={18} />}
                  leadingTone={t.amountCents > 0 ? "success" : "primary"}
                  title={t.description}
                  subtitle={`${t.category} · Today`}
                  value={`${t.amountCents > 0 ? "+" : "-"}${formatMoney(Math.abs(t.amountCents))}`}
                  valueTone={t.amountCents > 0 ? "positive" : "negative"}
                />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
