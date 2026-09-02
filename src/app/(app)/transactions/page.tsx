import { requireUser } from "@/lib/auth";
import { getAccount, getAllTransactions, startOfThisMonth } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { ListRow } from "@/components/ui/ListRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { formatMoney, formatSignedMoney, formatDayMonth } from "@/lib/format";
import { txnLeadingIcon, amountTone, txnValue } from "@/lib/txn";

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

  return (
    <div>
      <PageHeader title="Transactions" subtitle="All simulated money movement on your wallet." />

      <div className="flex flex-col gap-4">
        <StatCard label="Money in (this month)" value={formatMoney(moneyIn, currency)} />
        <StatCard label="Money out (this month)" value={formatMoney(Math.abs(moneyOut), currency)} tone="negative" />
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
              {txns.map((t) => (
                <ListRow
                  key={t.id}
                  leading={<Icon name={txnLeadingIcon(t.type, t.amountCents)} size={18} />}
                  title={t.description}
                  subtitle={`${t.category} · ${formatDayMonth(t.createdAt)}${t.country ? ` · ${t.country}` : ""}`}
                  value={txnValue(t.type, t.amountCents, formatSignedMoney(t.amountCents, currency))}
                  valueTone={amountTone(t.type, t.amountCents)}
                />
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
