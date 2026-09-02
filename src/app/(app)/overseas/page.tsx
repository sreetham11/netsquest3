import { requireUser } from "@/lib/auth";
import {
  getAccount,
  getOverseasTransactions,
  startOfThisMonth,
} from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { formatMoney, formatSignedMoney, formatDayMonth } from "@/lib/format";
import { formatLocalWithSgd } from "@/lib/currency";
import { flagForCountry } from "@/lib/countryFlag";
import { maxMilesDiscountCents, pointsForCents } from "@/lib/rewards";

// Overseas is a CURRENCY + REWARDS view, not a merchant directory: no named
// foreign merchants, no city deals, no map. It reuses getOverseasTransactions'
// existing filter (country IS NOT NULL) rather than defining its own.
export default async function OverseasPage() {
  const user = await requireUser();
  const [account, txns] = await Promise.all([
    getAccount(user.id),
    getOverseasTransactions(user.id),
  ]);
  const currency = account?.currency ?? "SGD";
  const points = account?.rewardPoints ?? 0;

  // Month total is derived from the same reused query — no second filter.
  const since = startOfThisMonth();
  const monthSpendCents = txns
    .filter((t) => t.createdAt >= since && t.amountCents < 0)
    .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);

  return (
    <div>
      <PageHeader
        title="Overseas"
        subtitle="Foreign-currency spend, converted to SGD at settlement."
      />

      {txns.length === 0 ? (
        <EmptyState
          icon={<Icon name="overseas" size={22} />}
          title="No overseas spend yet"
          description="Payments made abroad will show here with the local and SGD amounts."
        />
      ) : (
        <>
          <StatCard
            label="Overseas spend this month"
            value={formatMoney(monthSpendCents, currency)}
            hint="Settled in SGD"
            tone="negative"
          />

          {/* Miles work identically abroad — same rate, same 50% cap, same
              helper as the Pay/Bill checkout flow. Nothing overseas-specific. */}
          <Card className="mt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
                <Icon name="rewards" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">Miles work overseas too</p>
                <p className="text-sm text-ink-muted">
                  Same as at home: 100 pts = $1.00, up to 50% of a payment.
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              You have {points.toLocaleString()} pts.
            </p>
          </Card>

          <div className="mt-8">
            <h2 className="mb-3 text-xl font-bold text-ink">Overseas transactions</h2>
            <div className="flex flex-col gap-4">
              {txns.map((t) => {
                const sgdCents = Math.abs(t.amountCents);
                // The exact same helper the bill checkout uses.
                const milesCoverCents = maxMilesDiscountCents(sgdCents, points);
                return (
                  <Card key={t.id} padded={false} className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
                        <Icon name="overseas" size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {t.description}
                        </p>
                        <p className="truncate text-sm text-ink-muted">
                          {flagForCountry(t.country)}{t.country} · {formatDayMonth(t.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-danger-strong">
                        {formatSignedMoney(t.amountCents, currency)}
                      </span>
                    </div>

                    {/* Dual-currency line: local amount + approximate SGD. */}
                    {t.currencyLocal && t.amountLocalCents != null ? (
                      <p className="mt-3 border-t border-line pt-3 text-sm text-ink">
                        {formatLocalWithSgd(t.amountLocalCents, t.currencyLocal)}
                      </p>
                    ) : null}

                    {milesCoverCents > 0 ? (
                      <p className="mt-1.5 text-xs text-ink-muted">
                        Miles could cover {formatMoney(milesCoverCents, currency)} of this (
                        {pointsForCents(milesCoverCents).toLocaleString()} pts, max 50%)
                      </p>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          </div>

          <p className="mt-6 text-xs text-ink-muted">
            Converted amounts are illustrative demo rates, not live FX quotes. The
            SGD figure charged to your wallet is the settled amount shown above.
          </p>
        </>
      )}
    </div>
  );
}
