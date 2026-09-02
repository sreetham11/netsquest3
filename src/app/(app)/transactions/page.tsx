import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAccount, getAllTransactions, startOfThisMonth } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { ListRow } from "@/components/ui/ListRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { formatMoney, formatSignedMoney, formatDayMonth } from "@/lib/format";
import { txnLeadingIcon, amountTone, txnValue, splitHref, categorySpendStats, isHigherThanUsual } from "@/lib/txn";

export default async function TransactionsPage() {
  const user = await requireUser();
  const [account, txns] = await Promise.all([
    getAccount(user.id),
    getAllTransactions(user.id),
  ]);
  const currency = account?.currency ?? "SGD";

  const since = startOfThisMonth();
  const monthTxns = txns.filter((t) => t.createdAt >= since);
  const moneyIn = monthTxns.filter((t) => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0);
  const moneyOut = monthTxns.filter((t) => t.amountCents < 0).reduce((s, t) => s + t.amountCents, 0);

  // Computed once over the FULL history, not just what's rendered, so the
  // "usual" average isn't skewed by pagination/recency.
  const categoryStats = categorySpendStats(txns);

  return (
    <div>
      <PageHeader title="Transactions" subtitle="All simulated money movement on your wallet." />

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Money in (this month)"
          value={formatMoney(moneyIn, currency)}
          tone="positive"
        />
        <StatCard
          label="Money out (this month)"
          value={formatMoney(Math.abs(moneyOut), currency)}
          tone="negative"
        />
      </div>

      <div className="mt-8">
        {txns.length === 0 ? (
          <EmptyState
            icon={<Icon name="transactions" size={22} />}
            title="No transactions yet"
            description="Your activity will appear here once you start spending or topping up."
          />
        ) : (
          <Card padded={false}>
            <div className="divide-y divide-line px-6">
              {txns.map((t) => {
                const splitLink = splitHref(t.description, t.amountCents);
                const flagged = isHigherThanUsual(t, categoryStats);
                return (
                  <ListRow
                    key={t.id}
                    leading={<Icon name={txnLeadingIcon(t.type, t.amountCents, t.category)} size={18} />}
                    title={t.description}
                    subtitle={`${t.category} · ${formatDayMonth(t.createdAt)}${t.country ? ` · ${t.country}` : ""}`}
                    value={txnValue(t.type, t.amountCents, formatSignedMoney(t.amountCents, currency))}
                    valueTone={amountTone(t.type, t.amountCents)}
                    actions={
                      splitLink ? (
                        <Link
                          href={splitLink}
                          aria-label={`Split ${t.description}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-accent"
                        >
                          <Icon name="split" size={16} />
                        </Link>
                      ) : undefined
                    }
                    caption={
                      flagged ? (
                        <span className="inline-block rounded-full bg-danger px-2 py-0.5 font-medium text-white">
                          Higher than your usual {t.category} spend
                        </span>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
