import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRewards } from "@/lib/data/queries";
import { Icon } from "@/components/Icon";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatAmount, formatDayMonth, formatTime } from "@/lib/format";
import { PROGRAMME_NAME, POINTS_PER_DOLLAR, resolveTierProgress } from "@/lib/rewards";

// Outside (app)/, same reason as /pay itself: payment_successful/screen.png
// explicitly suppresses standard nav entirely for transactional/success
// screens, which AppShell's shared layout can't do per-route.
export default async function PaymentSuccessPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const user = await requireUser();
  const { transactionId } = await params;

  const [transaction, rewards] = await Promise.all([
    // include: pointLot — pointsEarned has to come from the PointLot this
    // payment actually created, not a recompute off amountCents. Once a
    // tier multiplier exists, how many points a payment earned depends on
    // which tier the payer was in at the time, which amountCents alone can't
    // tell you (and recomputing "now" would be wrong if the tier has since
    // changed, or 0 if the payment was later refunded and the lot depleted).
    prisma.transaction.findFirst({
      where: { id: transactionId, userId: user.id },
      include: { pointLot: true },
    }),
    // Reused, not reimplemented — same tier-progress logic the Rewards
    // page's Points tab already uses.
    getRewards(user.id),
  ]);
  // Scoped to userId above, so this 404s rather than leaking another
  // account's transaction if someone guesses/replays an old URL.
  if (!transaction) notFound();

  const pointsEarned = transaction.pointLot?.pointsEarned ?? 0;
  const { current: currentTier, next: nextTier, progress: tierProgress, atTopTier } =
    resolveTierProgress(rewards.tiers, rewards.monthlyPaymentCount);

  return (
    // Full-bleed background wrapper + a narrower centered content column,
    // same split ScanPay uses — bg-background belongs on the OUTER div so
    // desktop doesn't show a blank browser-default margin either side of a
    // narrow card. The max-w-md column itself is deliberately narrow even on
    // desktop (a receipt reads fine at that width; this isn't the "match
    // AppShell's max-w-3xl" case ScanPay needed, since there's no wide
    // scanner/list content here that would otherwise stretch awkwardly).
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-md flex-col items-center gap-stack-lg px-margin-mobile pb-24 pt-12">
      <div className="flex flex-col items-center gap-stack-sm">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success-green shadow-card">
          <Icon name="check" size={40} className="text-white" />
        </div>
        <h1 className="mt-2 text-headline-lg text-on-surface">Payment Successful</h1>
        <p className="text-body-md text-on-surface-variant">
          {formatDayMonth(transaction.createdAt)} · {formatTime(transaction.createdAt)}
        </p>
      </div>

      <div className="w-full rounded-lg border border-border-light bg-surface-container-lowest p-stack-md shadow-card">
        <div className="mb-stack-md flex flex-col items-center border-b border-border-light pb-stack-sm">
          <span className="mb-2 flex h-16 w-16 items-center justify-center rounded-lg border border-border-light bg-surface-container-low text-primary">
            <Icon name="storefront" size={28} />
          </span>
          <h2 className="text-headline-md text-on-surface">{transaction.description}</h2>
          <p className="mt-1 text-currency-display text-primary">
            <span className="text-headline-md">$</span>
            {formatAmount(Math.abs(transaction.amountCents))}
          </p>
        </div>
        <div className="flex justify-between py-1 text-body-md">
          <span className="text-on-surface-variant">Payment Method</span>
          {/* "NETS Prepaid •••• 0312" — the same placeholder card number
              already used throughout the rest of this app (Home/Activity's
              balance cards); Account has no real card-number field, this
              isn't a new fabrication introduced here. */}
          <span className="font-medium text-on-surface">NETS Prepaid •••• 0312</span>
        </div>
        <div className="mt-1 flex justify-between py-1 text-body-md">
          <span className="text-on-surface-variant">Transaction ID</span>
          <span className="font-mono text-on-surface">
            TXN{transaction.id.slice(-6).toUpperCase()}
          </span>
        </div>
      </div>

      <div className="w-full rounded-lg border border-gold-tier/40 bg-gold-tier/5 p-stack-md">
        <div className="mb-stack-md flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-tier">
              <Icon name="rewards" size={20} className="text-white" />
            </span>
            <div>
              <h3 className="text-title-lg text-on-surface">{currentTier?.name ?? "No tier yet"}</h3>
              {/* Resolved: flat 1 pt/$1, not Stitch's unconfirmed "6 pts/$1"
                  — see Home/Rewards for the same note. Tiers add a small
                  multiplier on top (shown when it isn't 1x). */}
              <p className="text-label-md text-on-surface-variant">
                {POINTS_PER_DOLLAR} pt / $1
                {currentTier && currentTier.multiplierPercent !== 100
                  ? ` × ${(currentTier.multiplierPercent / 100).toFixed(2).replace(/\.?0+$/, "")}`
                  : ""}
              </p>
            </div>
          </div>
          <p className="flex items-center gap-1 text-title-lg font-semibold text-success-green">
            <Icon name="circle-plus" size={18} />
            {pointsEarned} {PROGRAMME_NAME}
          </p>
        </div>

        {nextTier ? (
          <div className="rounded-lg border border-gold-tier/20 bg-surface-container-lowest/60 p-3">
            <div className="mb-2 flex items-end justify-between">
              <div>
                <p className="text-label-md uppercase tracking-wider text-on-surface-variant">
                  Next Tier
                </p>
                <p className="text-body-lg font-bold text-gold-tier">{nextTier.name}</p>
              </div>
              <span className="rounded-md bg-gold-tier/10 px-2 py-1 text-label-md font-bold text-on-surface">
                {rewards.monthlyPaymentCount} / {nextTier.txnCountNeeded} Payments
              </span>
            </div>
            <ProgressBar value={tierProgress} tone="gold" />
            <p className="mt-2 text-center text-body-md text-on-surface-variant">
              <span className="font-semibold text-on-surface">
                {nextTier.txnCountNeeded - rewards.monthlyPaymentCount}
              </span>{" "}
              more qualifying payments to upgrade
            </p>
          </div>
        ) : (
          <p className="text-center text-body-md text-on-surface-variant">
            {atTopTier ? "Top tier unlocked." : "Tiers aren't set up yet."}
          </p>
        )}
      </div>

      <div className="mt-auto flex w-full flex-col gap-stack-sm">
        <Link
          href="/home"
          className="flex min-h-14 items-center justify-center rounded-full bg-gradient-to-r from-primary to-nets-blue-gradient-end text-title-lg font-bold text-on-primary shadow-card"
        >
          Done
        </Link>
        {/* The data's already sitting right here — no reason to make anyone
            re-type description/amount into Split moments after paying. */}
        <Link
          href={`/split?from=${transaction.id}`}
          className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-primary/30 text-title-lg font-semibold text-primary hover:bg-surface-container"
        >
          <Icon name="split" size={18} />
          Split this
        </Link>
        <Link
          href="/transactions"
          className="flex min-h-12 items-center justify-center rounded-full text-title-lg font-semibold text-primary hover:bg-surface-container"
        >
          View Transaction
        </Link>
      </div>
      </div>
    </div>
  );
}
