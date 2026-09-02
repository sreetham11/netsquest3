"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/lib/format";
import { categoryIcon } from "@/lib/categoryIcon";
import { saveBudgetCap, type SaveBudgetCapState } from "../actions";

type BudgetTone = "accent" | "accent-strong" | "danger";

function toneFor(ratio: number): BudgetTone {
  if (ratio >= 1) return "danger";
  if (ratio >= 0.7) return "accent-strong";
  return "accent";
}

export function BudgetCategoryCard({
  category,
  limitCents,
  spentCents,
  currency,
}: {
  category: string;
  limitCents: number;
  spentCents: number;
  currency: string;
}) {
  const [editing, setEditing] = useState(false);
  const [limitAmount, setLimitAmount] = useState(String(limitCents / 100));
  // See AddBudgetForm — amount is client-validated, so the returned error is
  // a defensive backstop and this form collapses optimistically on submit.
  const [, formAction] = useActionState<SaveBudgetCapState, FormData>(saveBudgetCap, null);

  const ratio = limitCents > 0 ? spentCents / limitCents : 0;
  const tone = toneFor(ratio);
  const over = spentCents > limitCents;
  const remaining = limitCents - spentCents;

  function cancelEdit() {
    setEditing(false);
    setLimitAmount(String(limitCents / 100));
  }

  if (editing) {
    return (
      <Card padded={false} className="p-5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
            <Icon name={categoryIcon(category)} size={14} />
          </div>
          <p className="text-sm font-medium text-ink">{category}</p>
        </div>
        <form
          action={formAction}
          onSubmit={() => setEditing(false)}
          className="mt-3 flex flex-col gap-2"
        >
          <input type="hidden" name="category" value={category} />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-muted">Monthly cap</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
                $
              </span>
              <input
                name="limitAmount"
                type="number"
                min="0.01"
                step="0.01"
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
                className="w-full rounded-button border border-line bg-surface py-1.5 pl-5 pr-2 text-sm text-ink outline-none focus:border-accent"
                required
              />
            </div>
          </label>
          <Button type="submit" disabled={!(Number(limitAmount) > 0)} className="w-full justify-center">
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={cancelEdit} className="w-full justify-center">
            Cancel
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card padded={false} className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
            <Icon name={categoryIcon(category)} size={14} />
          </div>
          <p className="text-sm font-medium text-ink">{category}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-accent hover:text-accent-strong"
        >
          Edit
        </button>
      </div>
      <p className={`mt-3 text-lg font-bold ${over ? "text-danger-strong" : "text-ink"}`}>
        {over
          ? `${formatMoney(Math.abs(remaining), currency)} over`
          : `${formatMoney(remaining, currency)} left`}
      </p>
      <div className="mt-2">
        <ProgressBar value={ratio} tone={tone} size="lg" />
      </div>
      <p className="mt-1.5 text-right text-xs text-ink-muted">
        out of {formatMoney(limitCents, currency)}
      </p>
    </Card>
  );
}
