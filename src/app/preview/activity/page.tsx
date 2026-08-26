// Mirrors src/app/(app)/transactions/page.tsx. Reuses the REAL ActivityList
// component directly (src/app/(app)/transactions/ActivityList.tsx) — it's a
// "use client" component that only touches already-fetched data passed as
// props, txn.ts, format.ts, and netsPaymentTypes.ts, none of which import
// prisma or supabase. categoryIcon.ts is likewise pure.
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/Icon";
import { formatAmount, formatMoney } from "@/lib/format";
import { categoryIcon } from "@/lib/categoryIcon";
import { ActivityList } from "@/app/(app)/transactions/ActivityList";

const mockAccount = { balanceCents: 8400, currency: "SGD" };
const mockTxns = [
  { id: "1", description: "Kopitiam", category: "Food", amountCents: -840, type: "PAYMENT", country: null, createdAt: new Date("2026-08-27T13:29:00") },
  { id: "2", description: "FairPrice", category: "Groceries", amountCents: -2360, type: "PAYMENT", country: null, createdAt: new Date("2026-08-27T11:15:00") },
  { id: "3", description: "Bus/MRT", category: "Transport", amountCents: -192, type: "PAYMENT", country: null, createdAt: new Date("2026-08-26T08:45:00") },
  { id: "4", description: "Top-up", category: "Top-up", amountCents: 2000, type: "TOPUP", country: null, createdAt: new Date("2026-08-26T08:00:00") },
  { id: "5", description: "Redeemed: Coffee", category: "Rewards", amountCents: 0, type: "REWARD", country: null, createdAt: new Date("2026-08-25T09:00:00") },
];
const mockCategorySpend: Record<string, number> = { Food: 12400, Groceries: 18200, Transport: 4600, Shopping: 7300 };

export default function PreviewActivityPage() {
  const monthLabel = new Date().toLocaleDateString("en-SG", { month: "long" });
  const topCategories = Object.entries(mockCategorySpend).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div className="flex flex-col gap-stack-lg">
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-nets-blue-gradient-start to-nets-blue-gradient-end p-6 text-on-primary shadow-card">
        <p className="text-title-lg opacity-90">NETS Prepaid •0312</p>
        <div className="text-right">
          <span className="mr-1 text-body-md font-medium opacity-75">{mockAccount.currency}</span>
          <span className="text-currency-display tracking-tight">{formatAmount(mockAccount.balanceCents)}</span>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-headline-md text-on-surface">History</h2>
          <div className="flex gap-2">
            <button type="button" className="flex items-center gap-1.5 rounded-full border border-border-light px-3 py-1.5 text-label-md text-on-surface-variant">
              <Icon name="upload" size={16} />
              Export PDF
            </button>
            <button type="button" className="flex items-center gap-1.5 rounded-full border border-border-light px-3 py-1.5 text-label-md text-on-surface-variant">
              <Icon name="sliders" size={16} />
              Filters
            </button>
          </div>
        </div>
        <ActivityList txns={mockTxns} currency={mockAccount.currency} />
      </div>

      <div>
        <h2 className="text-headline-md text-on-surface">Monthly Insights</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">Your NETS spending for {monthLabel}</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {topCategories.map(([category, cents]) => (
            <Card key={category} className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5 text-on-surface-variant">
                <span className="rounded-md bg-primary/10 p-1.5 text-primary">
                  <Icon name={categoryIcon(category)} size={18} />
                </span>
                <span className="text-label-md font-medium">{category}</span>
              </div>
              <p className="text-headline-md text-on-surface">{formatMoney(cents)}</p>
            </Card>
          ))}
        </div>
        <Link href="/preview/more" className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 py-3 text-body-lg font-semibold text-primary">
          View Budget
          <Icon name="chevron-right" size={16} />
        </Link>
      </div>
    </div>
  );
}
