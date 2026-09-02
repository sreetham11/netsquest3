import { requireUser } from "@/lib/auth";
import { getAccount, getBills, startOfThisMonth } from "@/lib/data/queries";
import { maxMilesDiscountCents, pointsForCents } from "@/lib/rewards";
import { isDueSoon } from "@/lib/bills";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/lib/format";
import { BillCard } from "./BillCard";

export default async function BillsPage() {
  const user = await requireUser();
  const [account, bills] = await Promise.all([
    getAccount(user.id),
    getBills(user.id),
  ]);
  const currency = account?.currency ?? "SGD";
  const points = account?.rewardPoints ?? 0;
  const monthStart = startOfThisMonth();
  const monthlyTotal = bills.reduce((s, b) => s + b.amountCents, 0);

  return (
    <div>
      <PageHeader title="Bills" subtitle="Recurring payments on your wallet." />

      {bills.length === 0 ? (
        <EmptyState
          icon={<Icon name="bills" size={22} />}
          title="No bills set up"
          description="Recurring bills you add will appear here."
        />
      ) : (
        <div>
          <div className="flex flex-col gap-4">
            <StatCard label="Monthly total" value={formatMoney(monthlyTotal, currency)} />
            <StatCard label="Active bills" value={String(bills.length)} />
          </div>

          <div className="mt-8 flex flex-col gap-4">
            {bills.map((bill) => {
              const paidThisMonth = bill.lastPaidAt != null && bill.lastPaidAt >= monthStart;
              // Preview of the Miles discount for this bill. The Server Action
              // recomputes this from the same helper — the UI never decides
              // how many points are actually spent.
              const milesDiscountCents = maxMilesDiscountCents(bill.amountCents, points);
              return (
                <BillCard
                  key={bill.id}
                  bill={bill}
                  currency={currency}
                  paidThisMonth={paidThisMonth}
                  dueSoon={isDueSoon(bill.dueDayOfMonth, paidThisMonth)}
                  pointsBalance={points}
                  milesDiscountCents={milesDiscountCents}
                  milesPointsCost={pointsForCents(milesDiscountCents)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
