"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { createSavingsGoal } from "../actions";
import { GoalEstimateHelper } from "./GoalEstimateHelper";

// Uses useTransition + a direct action call (same pattern as TopUpForm and
// PayForm), NOT useActionState's "collapse optimistically on submit" pattern
// (see AddBudgetForm) — createSavingsGoal is a real server round-trip (and
// the "Help me estimate" flow below it makes real Anthropic calls), so this
// needs a genuine pending state the user can see. createSavingsGoal itself
// makes no AI call — the cost estimate it used to generate at creation time
// fabricated shopping lists and was removed; see savingsGoals.ts.
export function NewGoalForm({ currency }: { currency: string }) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentSaved, setCurrentSaved] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState("");
  const [justCreated, setJustCreated] = useState(false);
  const [pending, startTransition] = useTransition();
  // "Help me estimate" replaces the plain Target amount input with
  // GoalEstimateHelper's dynamic clarifying-question flow. Only shown when
  // the user asks for it — typing a target amount directly never touches
  // this at all. Keyed by `name` below so a goal-name edit mid-flow starts
  // the helper fresh rather than running stale questions against a new name.
  const [showEstimateHelper, setShowEstimateHelper] = useState(false);

  const canSubmit = name.trim().length > 0 && Number(targetAmount) > 0 && targetDate.length > 0;

  function reset() {
    setExpanded(false);
    setName("");
    setTargetAmount("");
    setCurrentSaved("");
    setTargetDate("");
    setError("");
    setJustCreated(false);
    setShowEstimateHelper(false);
  }

  function submit() {
    if (!canSubmit || pending) return;
    setError("");
    const formData = new FormData();
    formData.append("name", name);
    formData.append("targetAmount", targetAmount);
    formData.append("currentSaved", currentSaved || "0");
    formData.append("targetDate", targetDate);

    startTransition(async () => {
      const result = await createSavingsGoal(null, formData);
      if (!result?.ok) {
        setError(result?.error ?? "Couldn't create this goal. Try again.");
        return;
      }
      // A brief explicit success beat (green checkmark), same as every
      // other action flow, rather than silently collapsing straight back —
      // reset() (which actually collapses the form) fires from "Done" below.
      setJustCreated(true);
    });
  }

  if (justCreated) {
    return (
      <Card className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success text-white">
          <Icon name="check" size={18} />
        </span>
        <p className="text-sm font-semibold text-ink">Goal created</p>
        <Button type="button" onClick={reset} className="w-full justify-center">
          Done
        </Button>
      </Card>
    );
  }

  if (!expanded) {
    return (
      <Button type="button" onClick={() => setExpanded(true)} className="w-full justify-center">
        <Icon name="plus" size={18} />
        New goal
      </Button>
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="h-1.5 bg-accent" />
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">New savings goal</h2>
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="text-sm text-ink-muted hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Goal name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Trip to Japan"
              disabled={pending}
              className="rounded-button border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:opacity-60"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Target amount</span>
            {showEstimateHelper ? (
              // Keyed by name: if the user edits the goal name mid-flow, this
              // remounts fresh rather than running stale questions/answers
              // against a different goal. Purely informational — it never
              // writes to targetAmount; whatever the user already typed (or
              // didn't) is untouched when this closes.
              <GoalEstimateHelper
                key={name}
                goalName={name}
                currency={currency}
                onDone={() => setShowEstimateHelper(false)}
              />
            ) : (
              <>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                    $
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={pending}
                    className="w-full rounded-button border border-line bg-surface py-2 pl-7 pr-3 text-sm text-ink outline-none focus:border-accent disabled:opacity-60"
                  />
                </div>
                {/* Only offered once there's a goal name to send Claude —
                    hidden rather than disabled, since an empty-name error
                    state for a not-yet-visible feature would be confusing. */}
                {name.trim() ? (
                  <button
                    type="button"
                    onClick={() => setShowEstimateHelper(true)}
                    className="self-start text-xs font-medium text-accent hover:text-accent-strong"
                  >
                    Not sure? Help me estimate
                  </button>
                ) : null}
              </>
            )}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Target date</span>
            <input
              type="date"
              min={todayIso}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              disabled={pending}
              className="rounded-button border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:opacity-60"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Already saved (optional)</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={currentSaved}
                onChange={(e) => setCurrentSaved(e.target.value)}
                placeholder="0.00"
                disabled={pending}
                className="w-full rounded-button border border-line bg-surface py-2 pl-7 pr-3 text-sm text-ink outline-none focus:border-accent disabled:opacity-60"
              />
            </div>
          </label>

          {error ? <p className="text-sm text-danger-strong">{error}</p> : null}

          <Button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            loading={pending}
            className="w-full justify-center"
          >
            {pending ? "Creating goal…" : "Create goal"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
