"use client";

import { useActionState, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Icon } from "@/components/Icon";
import { formatMoney, formatDate } from "@/lib/format";
import { requiredMonthlySavings, parseGoalCoachResult, type GoalCoachResult } from "@/lib/savingsGoals";
import {
  updateSavingsGoalProgress,
  refreshGoalSuggestions,
  type UpdateSavingsProgressState,
} from "../actions";

export function SavingsGoalCard({
  goal,
  currency,
}: {
  goal: {
    id: string;
    name: string;
    targetAmountCents: number;
    currentSavedCents: number;
    targetDate: Date;
    aiSuggestions: string | null;
    aiSuggestionsAt: Date | null;
  };
  currency: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savedAmount, setSavedAmount] = useState(String(goal.currentSavedCents / 100));
  // See BudgetCategoryCard — this write is fast (no AI call), so the
  // optimistic-collapse useActionState pattern fits fine here, unlike the
  // create form below which needs real pending feedback.
  const [, updateAction] = useActionState<UpdateSavingsProgressState, FormData>(
    updateSavingsGoalProgress,
    null,
  );

  const [coachResult, setCoachResult] = useState<GoalCoachResult | null>(
    parseGoalCoachResult(goal.aiSuggestions),
  );
  const [coachError, setCoachError] = useState("");
  const [coachPending, startCoachTransition] = useTransition();

  const { remainingCents, monthsRemaining, monthlyCents } = requiredMonthlySavings({
    targetAmountCents: goal.targetAmountCents,
    currentSavedCents: goal.currentSavedCents,
    targetDate: goal.targetDate,
  });
  const progress =
    goal.targetAmountCents > 0
      ? Math.min(1, goal.currentSavedCents / goal.targetAmountCents)
      : 0;
  const reached = remainingCents <= 0;

  function cancelEdit() {
    setEditing(false);
    setSavedAmount(String(goal.currentSavedCents / 100));
  }

  // Always re-fetches and recomputes from the latest transaction stats
  // (refreshGoalSuggestions never caches or randomizes) — "Refresh
  // suggestions" is a real recomputation, not a new random AI response.
  function getCoachTips() {
    if (coachPending) return;
    setCoachError("");
    startCoachTransition(async () => {
      const result = await refreshGoalSuggestions(goal.id);
      if (!result.ok) {
        setCoachError(result.error);
        return;
      }
      setCoachResult(result.result);
    });
  }

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="h-1.5 bg-accent" />
      <div className="p-6">
        {/* Collapsed summary — icon, name, target date, saved/target amount,
            progress bar. The whole thing is the toggle target (plus the
            chevron as an explicit affordance); nothing interactive lives
            inside it, so a plain <button> wrapper is valid here. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="w-full text-left"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                <Icon name="target" size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-ink">{goal.name}</h2>
                <p className="text-xs text-ink-muted">Target {formatDate(goal.targetDate)}</p>
              </div>
            </div>
            <Icon
              name="chevron"
              size={20}
              className={
                "mt-1 shrink-0 text-ink-muted transition-transform duration-200 " +
                (expanded ? "rotate-180" : "")
              }
            />
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold text-ink">
                {formatMoney(goal.currentSavedCents, currency)}
              </span>
              <span className="text-sm text-ink-muted">
                of {formatMoney(goal.targetAmountCents, currency)}
              </span>
            </div>
            <div className="mt-2">
              <ProgressBar value={progress} tone="accent" size="lg" />
            </div>
          </div>
        </button>

        {expanded ? (
          <>
            {/* Required savings — pure math, no AI. */}
            <div className="mt-4 rounded-button bg-surface-muted px-3 py-2.5">
              {reached ? (
                <p className="text-sm font-medium text-accent">Goal reached — nice work.</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-ink">
                    You need to save {formatMoney(monthlyCents, currency)}/month to hit this goal.
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {monthsRemaining} month{monthsRemaining === 1 ? "" : "s"} remaining ·{" "}
                    {formatMoney(remainingCents, currency)} to go
                  </p>
                </>
              )}
            </div>

            {/* Update saved amount — inline edit, mirrors BudgetCategoryCard. */}
            {editing ? (
              <form
                action={updateAction}
                onSubmit={() => setEditing(false)}
                className="mt-3 flex flex-col gap-2"
              >
                <input type="hidden" name="goalId" value={goal.id} />
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-ink-muted">Amount saved so far</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
                      $
                    </span>
                    <input
                      name="saved"
                      type="number"
                      min="0"
                      step="0.01"
                      value={savedAmount}
                      onChange={(e) => setSavedAmount(e.target.value)}
                      className="w-full rounded-button border border-line bg-surface py-1.5 pl-5 pr-2 text-sm text-ink outline-none focus:border-accent"
                      required
                    />
                  </div>
                </label>
                <div className="flex gap-2">
                  <Button type="submit" disabled={!(Number(savedAmount) >= 0)} className="flex-1 justify-center">
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={cancelEdit}
                    className="flex-1 justify-center"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="mt-3 text-xs font-medium text-accent hover:text-accent-strong"
              >
                Update saved amount
              </button>
            )}

            {/* AI Goal Coach — chat-bubble-style tips, on demand. No cost
                breakdown, no free-text/back-and-forth chat: general mode is
                pure code-computed math + generic tips (no AI call);
                personalized mode shows real spending evidence and a
                code-computed goal impact for every category, with only the
                one-sentence reasoning coming from Claude. See
                refreshGoalSuggestions in ../actions.ts. */}
            <div className="mt-5 border-t border-line pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">AI Goal Coach</p>
                <button
                  type="button"
                  onClick={getCoachTips}
                  disabled={coachPending || reached}
                  className="text-xs font-medium text-accent hover:text-accent-strong disabled:opacity-50"
                >
                  {coachPending ? "Thinking…" : coachResult ? "Refresh suggestions" : "Get suggestions"}
                </button>
              </div>

              <div className="mt-2">
                {reached ? (
                  <p className="text-xs text-ink-muted">No cuts needed — this goal is already funded.</p>
                ) : coachError ? (
                  <p className="text-sm text-danger-strong">{coachError}</p>
                ) : coachResult ? (
                  <GoalCoachTips result={coachResult} currency={currency} targetDate={goal.targetDate} />
                ) : (
                  <p className="text-xs text-ink-muted">
                    Get AI Goal Coach tips grounded in your real transaction history.
                  </p>
                )}
              </div>

              {coachResult?.mode === "personalized" && goal.aiSuggestionsAt ? (
                <p className="mt-2 text-right text-[11px] text-ink-muted">
                  Based on spending as of {formatDate(goal.aiSuggestionsAt)}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </Card>
  );
}

// One incoming-message-style bubble per tip/suggestion — visual only, never
// an input box and never a back-and-forth thread.
function ChatBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-white">
        <Icon name="message" size={13} />
      </div>
      <div className="flex-1 rounded-2xl rounded-tl-sm bg-surface-muted px-3 py-2.5 text-sm text-ink">
        {children}
      </div>
    </div>
  );
}

function GoalCoachTips({
  result,
  currency,
  targetDate,
}: {
  result: GoalCoachResult;
  currency: string;
  targetDate: Date;
}) {
  if (result.mode === "general") {
    return (
      <div className="flex flex-col gap-2">
        <ChatBubble>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            General idea
          </span>
          <p className="mt-1">
            Not enough spending history yet for personalized tips — to save{" "}
            <span className="font-semibold">{formatMoney(result.remainingCents, currency)}</span> by{" "}
            {formatDate(targetDate)}, you need about{" "}
            <span className="font-semibold">{formatMoney(result.weeklyCents, currency)}/week</span>.
          </p>
        </ChatBubble>
        {result.tips.map((tip, i) => (
          <ChatBubble key={i}>{tip}</ChatBubble>
        ))}
      </div>
    );
  }

  if (result.mode === "no-candidates") {
    return (
      <ChatBubble>
        Your spending looks in line with your usual average right now — nothing specific to flag.
      </ChatBubble>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {result.suggestions.map((s, i) => (
        <ChatBubble key={i}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-ink">{s.category}</span>
            <span className="font-semibold text-accent">
              -{formatMoney(s.suggestedReductionCents, currency)}/mo
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {formatMoney(s.currentPeriodCents, currency)} spent this month vs your{" "}
            {formatMoney(s.averageMonthlyCents, currency)} average
          </p>
          <p className="mt-1">{s.reasoning}</p>
          {s.daysSooner > 0 ? (
            <p className="mt-1 text-xs font-medium text-accent">
              Could help you reach this goal ~{s.daysSooner} day{s.daysSooner === 1 ? "" : "s"} sooner
            </p>
          ) : null}
        </ChatBubble>
      ))}
    </div>
  );
}
