"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { BUDGET_CATEGORIES } from "@/lib/categoryIcon";
import { saveBudgetCap, type SaveBudgetCapState } from "../actions";

export function AddBudgetForm({ existingCategories }: { existingCategories: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const available = BUDGET_CATEGORIES.filter((c) => !existingCategories.includes(c));
  const [category, setCategory] = useState(available[0] ?? "");
  const [limitAmount, setLimitAmount] = useState("");
  // Category/amount are already client-validated below, so the returned
  // state (error) is a defensive backstop, not something worth wiring UI
  // for — this form collapses optimistically on submit instead.
  const [, formAction] = useActionState<SaveBudgetCapState, FormData>(saveBudgetCap, null);

  function reset() {
    setExpanded(false);
    setCategory(available[0] ?? "");
    setLimitAmount("");
  }

  if (!expanded) {
    return (
      <Button
        type="button"
        onClick={() => setExpanded(true)}
        disabled={available.length === 0}
        className="w-full justify-center"
      >
        <Icon name="plus" size={18} />
        Set budget
      </Button>
    );
  }

  const canSubmit = category.length > 0 && Number(limitAmount) > 0;

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="h-1.5 bg-accent" />
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Set a budget</h2>
          <button type="button" onClick={reset} className="text-sm text-ink-muted hover:text-ink">
            Cancel
          </button>
        </div>

        {/* Collapses immediately on submit rather than waiting on the server
            round-trip — category/amount are already client-validated below,
            so there's no meaningful error state worth staying open for. */}
        <form action={formAction} onSubmit={reset} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Category</span>
            <select
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-button border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            >
              {available.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Monthly cap</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                $
              </span>
              <input
                name="limitAmount"
                type="number"
                min="0.01"
                step="0.01"
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-button border border-line bg-surface py-2 pl-7 pr-3 text-sm text-ink outline-none focus:border-accent"
                required
              />
            </div>
          </label>

          <Button type="submit" disabled={!canSubmit} className="w-full justify-center">
            Save
          </Button>
        </form>
      </div>
    </Card>
  );
}
