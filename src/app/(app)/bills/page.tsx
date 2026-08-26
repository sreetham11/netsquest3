import { requireUser } from "@/lib/auth";
import { getAccount, getBills, startOfThisMonth } from "@/lib/data/queries";
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
        // Short by nature (a handful of recurring bills) — cap to the remaining
        // viewport height on desktop and center, instead of leaving a void below.
        <div className="lg:flex lg:min-h-[calc(100vh-11rem)] lg:flex-col lg:justify-center">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Monthly total" value={formatMoney(monthlyTotal, currency)} />
            <StatCard label="Active bills" value={String(bills.length)} />
          </div>

          <div className="mt-8 flex flex-col gap-4">
            {bills.map((bill) => {
              const paidThisMonth = bill.lastPaidAt != null && bill.lastPaidAt >= monthStart;
              return (
                <BillCard key={bill.id} bill={bill} currency={currency} paidThisMonth={paidThisMonth} />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
