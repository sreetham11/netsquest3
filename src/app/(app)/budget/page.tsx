import { requireUser } from "@/lib/auth";
import { getAccount, getBudgets } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/lib/format";
import { AddBudgetForm } from "./AddBudgetForm";
import { BudgetCategoryCard } from "./BudgetCategoryCard";

type BudgetTone = "accent" | "accent-strong" | "danger" | "empty";

// Risk gradation stays within the locked blue family per the confirmed
// decision: under 70% = accent, 70-99% = accent-strong (darker blue, no new
// token), 100%+ = danger (red — a real alert, not decoration). "empty" (see
// below) is a distinct, softer case layered on top of this, not part of the
// gradation itself.
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
  // $0 spent is a distinct, deliberately softer state — NOT "0% health" red
  // flag territory. Ring is drawn as a full pale arc (not a 0%-drawn accent
  // arc, which would look identical to no ring at all) and the readout talks
  // about how much is remaining rather than how little has been used.
  const noSpend = totalSpent === 0;
  const totalTone: BudgetTone = noSpend ? "empty" : toneFor(totalRatio);
  const totalLeft = totalCap - totalSpent;

  return (
    <div>
      <PageHeader title="Budget" subtitle="Monthly spending caps by category." />

      {/* Budget Health — the first thing on the page, above the fold, never
          buried at the bottom under the "left" or "over" mini-cards. */}
      {budgets.length > 0 ? (
        <Card className="flex flex-col items-center gap-4 text-center">
          <div className="relative flex h-[92px] w-[92px] shrink-0 items-center justify-center">
            <ProgressRing value={noSpend ? 1 : totalRatio} tone={totalTone} size={92} strokeWidth={10} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-xl font-bold ${noSpend ? "text-ink-muted" : "text-ink"}`}>
                {noSpend ? "100%" : `${Math.round(totalRatio * 100)}%`}
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-ink-muted">Budget Health</p>
            <p
              className={`mt-2 text-lg font-semibold ${totalTone === "danger" ? "text-danger-strong" : "text-ink"}`}
            >
              {noSpend
                ? "100% remaining"
                : totalLeft >= 0
                  ? `${formatMoney(totalLeft, currency)} left`
                  : `${formatMoney(Math.abs(totalLeft), currency)} over`}
            </p>
          </div>
        </Card>
      ) : null}

      <div className="mt-6">
        <AddBudgetForm existingCategories={existingCategories} />
      </div>

      {budgets.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Icon name="budget" size={22} />}
            title="No budgets set yet"
            description="Add a category cap above (e.g. Food, $400/month) to start tracking your monthly spending against a real limit."
          />
        </div>
      ) : (
        // ONE list — category icon, name, thin progress bar, remaining
        // amount. (There used to be a second plain list above this one
        // repeating the same categories/amounts; removed rather than kept
        // in sync.)
        <div className="mt-6 flex flex-col gap-4">
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
      )}
    </div>
  );
}
