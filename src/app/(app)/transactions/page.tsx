import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getAccount,
  getAllTransactions,
  getMonthlySpendByCategory,
  startOfThisMonth,
} from "@/lib/data/queries";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { formatAmount, formatMoney } from "@/lib/format";
import { categoryIcon } from "@/lib/categoryIcon";
import { isNetsPaymentType } from "@/lib/netsPaymentTypes";
import { ActivityList } from "./ActivityList";
import { RefundButton } from "./RefundButton";

export default async function TransactionsPage() {
  const user = await requireUser();
  const [account, txns, categorySpend] = await Promise.all([
    getAccount(user.id),
    getAllTransactions(user.id),
    // Reused, not reimplemented — the same query Budget already calls, for
    // the Monthly Insights teaser's real numbers below.
    getMonthlySpendByCategory(user.id),
  ]);
  const currency = account?.currency ?? "SGD";

  // Pre-rendered here (server-side), not passed down as a callback — a
  // function can't cross the Server->Client Component boundary (ActivityList
  // is "use client"); only serializable data/JSX can. Refundable: a real
  // NETS payment (not a top-up/transfer/etc — isNetsPaymentType already
  // excludes those), a debit, and not already refunded.
  const refundActionsById = Object.fromEntries(
    txns
      .filter((t) => isNetsPaymentType(t.type) && t.amountCents < 0 && !t.refundedAt)
      .map((t) => [t.id, <RefundButton key={t.id} transactionId={t.id} />]),
  );

  const since = startOfThisMonth();
  const monthLabel = since.toLocaleDateString("en-SG", { month: "long" });
  const topCategories = Object.entries(categorySpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-stack-lg">
      {/* Balance strip — smaller than Home's Main Card (no quick actions, no
          Active badge), matching activity/screen.png's simpler top card. */}
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-nets-blue-gradient-start to-nets-blue-gradient-end p-6 text-on-primary shadow-card">
        <p className="text-title-lg opacity-90">NETS Prepaid •0312</p>
        <div className="text-right">
          <span className="mr-1 text-body-md font-medium opacity-75">{currency}</span>
          <span className="text-currency-display tracking-tight">
            {formatAmount(account?.balanceCents ?? 0)}
          </span>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-headline-md text-on-surface">History</h2>
          <div className="flex gap-2">
            {/* Export PDF / Filters — present in the reference screen, but
                neither has real behavior to wire up: there's no PDF-export
                capability anywhere in this app, and the chip row below
                (ActivityList) already IS the real filter control. Rendered
                as inert buttons so the screen's layout isn't missing pieces,
                without pretending either does something it doesn't. */}
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-border-light px-3 py-1.5 text-label-md text-on-surface-variant"
            >
              <Icon name="upload" size={16} />
              Export PDF
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-border-light px-3 py-1.5 text-label-md text-on-surface-variant"
            >
              <Icon name="sliders" size={16} />
              Filters
            </button>
          </div>
        </div>

        {txns.length === 0 ? (
          <EmptyState
            icon={<Icon name="transactions" size={22} />}
            title="No transactions yet"
            description="Your activity will appear here once you start spending or topping up."
          />
        ) : (
          <ActivityList txns={txns} currency={currency} refundActionsById={refundActionsById} />
        )}
        {/* No "View More Activity" button: getAllTransactions already returns
            the complete history (unchanged, unpaginated) — there's nothing
            further to load, so a button implying otherwise would be
            misleading rather than just decorative. */}
      </div>

      {/* Monthly Insights — a teaser into Budget, not a rebuild of its cap/
          ratio logic (explicitly out of scope): real numbers via the same
          query Budget uses, but no progress bars against a cap here. Stitch's
          own bars don't sum to 100% of anything either (45+65+25+35%), so
          they read as decorative cap-relative fills — exactly the Budget-
          specific visual this section is told not to duplicate. */}
      <div>
        <h2 className="text-headline-md text-on-surface">Monthly Insights</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Your NETS spending for {monthLabel}
        </p>
        {topCategories.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<Icon name="budget" size={22} />}
              title="No spending yet this month"
              description="Your category breakdown will show up here."
            />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {topCategories.map(([category, cents]) => (
              <Card key={category} className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5 text-on-surface-variant">
                  <span className="rounded-md bg-primary/10 p-1.5 text-primary">
                    <Icon name={categoryIcon(category)} size={18} />
                  </span>
                  <span className="text-label-md font-medium">{category}</span>
                </div>
                <p className="text-headline-md text-on-surface">{formatMoney(cents, currency)}</p>
              </Card>
            ))}
          </div>
        )}
        <Link
          href="/budget"
          className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 py-3 text-body-lg font-semibold text-primary hover:bg-primary/10"
        >
          View Budget
          <Icon name="chevron-right" size={16} />
        </Link>
      </div>
    </div>
  );
}
