import { requireUser } from "@/lib/auth";
import { getAccount, getBudgets } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/lib/format";
import { categoryIcon } from "@/lib/categoryIcon";
import { AddBudgetForm } from "./AddBudgetForm";
import { BudgetCategoryCard } from "./BudgetCategoryCard";

type BudgetTone = "accent" | "accent-strong" | "danger";

// Risk gradation stays within the locked blue family per the confirmed
// decision: under 70% = accent, 70-99% = accent-strong (darker blue, no new
// token), 100%+ = danger (red — a real alert, not decoration).
function toneFor(ratio: number): BudgetTone {
  if (ratio >= 1) return "danger";
  if (ratio >= 0.7) return "accent-strong";
  return "accent";
}

export default async function BudgetPage() {
  const user = await requireUser();
  const [account, budgets] = await Promise.all([
    getAccount(user.id),
    getBudgets(user.id),
  ]);
  const currency = account?.currency ?? "SGD";
  const existingCategories = budgets.map((b) => b.category);

  const totalCap = budgets.reduce((s, b) => s + b.limitCents, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spentCents, 0);
  const totalRatio = totalCap > 0 ? totalSpent / totalCap : 0;
  const totalTone = toneFor(totalRatio);
  const totalLeft = totalCap - totalSpent;

  return (
    <div>
      <PageHeader title="Budget" subtitle="Monthly spending caps by category." />

      <div className="mb-6">
        <AddBudgetForm existingCategories={existingCategories} />
      </div>

      {budgets.length === 0 ? (
        <EmptyState
          icon={<Icon name="budget" size={22} />}
          title="No budgets set yet"
          description="Add a category cap above (e.g. Food, $400/month) to start tracking your monthly spending against a real limit."
        />
      ) : (
        <>
          {/* Top summary — a dense at-a-glance list (left) paired with the
              overall-health ring (right), read as one connected unit. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card padded={false}>
              <div className="border-b border-line px-6 py-4">
                <p className="text-sm font-medium text-ink-muted">Total Spent</p>
                <p className="mt-1 text-2xl font-bold text-ink">{formatMoney(totalSpent, currency)}</p>
              </div>
              <div className="divide-y divide-line px-6">
                {budgets.map((b) => (
                  <ListRow
                    key={b.id}
                    leading={<Icon name={categoryIcon(b.category)} size={16} />}
                    title={b.category}
                    value={formatMoney(b.spentCents, currency)}
                    valueHint={`of ${formatMoney(b.limitCents, currency)}`}
                  />
                ))}
              </div>
            </Card>

            <Card className="flex items-center gap-6">
              <div className="relative flex h-[92px] w-[92px] shrink-0 items-center justify-center">
                <ProgressRing value={totalRatio} tone={totalTone} size={92} strokeWidth={10} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-ink">{Math.round(totalRatio * 100)}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-ink-muted">Budget Health</p>
                <p
                  className={`mt-2 text-lg font-semibold ${totalTone === "danger" ? "text-danger-strong" : "text-ink"}`}
                >
                  {totalLeft >= 0
                    ? `${formatMoney(totalLeft, currency)} left`
                    : `${formatMoney(Math.abs(totalLeft), currency)} over`}
                </p>
              </div>
            </Card>
          </div>

          {/* Category breakdown — compact mini-cards: "$X left" + bar + "out of $Y".
              Each is independently editable (click Edit to adjust its cap). */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {budgets.map((b) => (
              <BudgetCategoryCard
                key={b.id}
                category={b.category}
                limitCents={b.limitCents}
                spentCents={b.spentCents}
                currency={currency}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
