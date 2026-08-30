// Mirrors src/app/pay/success/[transactionId]/page.tsx — same layout, real
// resolveTierProgress (pure, no prisma/supabase import). Transaction
// description/amount come from what was actually typed on the preview pay
// screen (passed via URL search params, since this is a plain client-side
// navigation with no server action or prisma write behind it); everything
// else here (tiers, monthly count, points earned) stays hardcoded mock data.
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatAmount, formatDayMonth, formatTime } from "@/lib/format";
import { POINTS_PER_DOLLAR, resolveTierProgress } from "@/lib/rewards";

const mockTiers = [
  { id: "1", name: "Bronze", txnCountNeeded: 0 },
  { id: "2", name: "Silver", txnCountNeeded: 20 },
  { id: "3", name: "Gold", txnCountNeeded: 50 },
  { id: "4", name: "Platinum", txnCountNeeded: 100 },
];
const mockMonthlyPaymentCount = 33;
const pointsEarned = 24;

export default async function PreviewPaySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ merchant?: string; amount?: string }>;
}) {
  const params = await searchParams;
  const amountCents = Number(params.amount);
  const mockTransaction = {
    description: params.merchant?.trim() || "Kopitiam",
    amountCents: -(Number.isFinite(amountCents) && amountCents > 0 ? amountCents : 840),
    createdAt: new Date(),
    id: "clxpreviewmocktxn1",
  };

  const { current: currentTier, next: nextTier, progress: tierProgress } = resolveTierProgress(
    mockTiers,
    mockMonthlyPaymentCount,
  );

  return (
    <div className="mx-auto flex flex-col items-center gap-stack-lg pb-8">
      <div className="flex flex-col items-center gap-stack-sm">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success-green shadow-card">
          <Icon name="check" size={40} className="text-white" />
        </div>
        <h1 className="mt-2 text-headline-lg text-on-surface">Payment Successful</h1>
        <p className="text-body-md text-on-surface-variant">
          {formatDayMonth(mockTransaction.createdAt)} · {formatTime(mockTransaction.createdAt)}
        </p>
      </div>

      <div className="w-full rounded-lg border border-border-light bg-surface-container-lowest p-stack-md shadow-card">
        <div className="mb-stack-md flex flex-col items-center border-b border-border-light pb-stack-sm">
          <span className="mb-2 flex h-16 w-16 items-center justify-center rounded-lg border border-border-light bg-surface-container-low text-primary">
            <Icon name="storefront" size={28} />
          </span>
          <h2 className="text-headline-md text-on-surface">{mockTransaction.description}</h2>
          <p className="mt-1 text-currency-display text-primary">
            <span className="text-headline-md">$</span>
            {formatAmount(Math.abs(mockTransaction.amountCents))}
          </p>
        </div>
        <div className="flex justify-between py-1 text-body-md">
          <span className="text-on-surface-variant">Payment Method</span>
          <span className="font-medium text-on-surface">NETS Prepaid •••• 0312</span>
        </div>
        <div className="mt-1 flex justify-between py-1 text-body-md">
          <span className="text-on-surface-variant">Transaction ID</span>
          <span className="font-mono text-on-surface">TXN{mockTransaction.id.slice(-6).toUpperCase()}</span>
        </div>
      </div>

      <div className="w-full rounded-lg border border-gold-tier/40 bg-gold-tier/5 p-stack-md">
        <div className="mb-stack-md flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-tier">
              <Icon name="rewards" size={20} className="text-white" />
            </span>
            <div>
              <h3 className="text-title-lg text-on-surface">{currentTier?.name}</h3>
              <p className="text-label-md text-on-surface-variant">{POINTS_PER_DOLLAR} pts / $1</p>
            </div>
          </div>
          <p className="flex items-center gap-1 text-title-lg font-semibold text-success-green">
            <Icon name="circle-plus" size={18} />
            {pointsEarned} NETS Points
          </p>
        </div>

        {nextTier ? (
          <div className="rounded-lg border border-gold-tier/20 bg-surface-container-lowest/60 p-3">
            <div className="mb-2 flex items-end justify-between">
              <div>
                <p className="text-label-md uppercase tracking-wider text-on-surface-variant">Next Tier</p>
                <p className="text-body-lg font-bold text-gold-tier">{nextTier.name}</p>
              </div>
              <span className="rounded-md bg-gold-tier/10 px-2 py-1 text-label-md font-bold text-on-surface">
                {mockMonthlyPaymentCount} / {nextTier.txnCountNeeded} Payments
              </span>
            </div>
            <ProgressBar value={tierProgress} tone="gold" />
            <p className="mt-2 text-center text-body-md text-on-surface-variant">
              <span className="font-semibold text-on-surface">{nextTier.txnCountNeeded - mockMonthlyPaymentCount}</span> more
              qualifying payments to upgrade
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex w-full flex-col gap-stack-sm">
        <Link
          href="/preview/home"
          className="flex min-h-14 items-center justify-center rounded-full bg-gradient-to-r from-primary to-nets-blue-gradient-end text-title-lg font-bold text-on-primary shadow-card"
        >
          Done
        </Link>
        <Link href="/preview/activity" className="flex min-h-12 items-center justify-center rounded-full text-title-lg font-semibold text-primary">
          View Transaction
        </Link>
      </div>
    </div>
  );
}
