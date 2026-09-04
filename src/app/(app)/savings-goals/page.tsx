import { requireUser } from "@/lib/auth";
import { getAccount, getSavingsGoals } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { NewGoalForm } from "./NewGoalForm";
import { SavingsGoalCard } from "./SavingsGoalCard";

// Entirely new/additive feature: reads Account (for currency) and, inside
// the Server Actions, Transaction (for the AI cut-suggestion prompt) — never
// writes to either, and never touches Budget/BudgetCap at all. currentSaved
// is its own standalone tracked number on SavingsGoal, not derived from
// Account.balanceCents (this app has no real fund-earmarking mechanism).
export default async function SavingsGoalsPage() {
  const user = await requireUser();
  const [account, goals] = await Promise.all([getAccount(user.id), getSavingsGoals(user.id)]);
  const currency = account?.currency ?? "SGD";

  return (
    <div>
      <PageHeader
        title="Savings Goals"
        subtitle="Set a target, see what it'll take each month, and get AI suggestions on where to cut."
      />

      <div className="mt-4">
        <NewGoalForm currency={currency} />
      </div>

      {goals.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Icon name="target" size={22} />}
            title="No savings goals yet"
            description="Add a goal above (e.g. 'Trip to Japan', $2,000, by next June) to see what you'd need to save each month."
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {goals.map((goal) => (
            <SavingsGoalCard key={goal.id} goal={goal} currency={currency} />
          ))}
        </div>
      )}
    </div>
  );
}
