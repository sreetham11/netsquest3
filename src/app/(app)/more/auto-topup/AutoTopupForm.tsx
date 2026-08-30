"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { saveAutoTopupSettings, type SaveAutoTopupState } from "../../actions";

export function AutoTopupForm({
  initialEnabled,
  initialThresholdCents,
  initialAmountCents,
}: {
  initialEnabled: boolean;
  initialThresholdCents: number | null;
  initialAmountCents: number | null;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [threshold, setThreshold] = useState(
    initialThresholdCents != null ? (initialThresholdCents / 100).toFixed(2) : "",
  );
  const [amount, setAmount] = useState(initialAmountCents != null ? (initialAmountCents / 100).toFixed(2) : "");
  const [state, formAction, pending] = useActionState<SaveAutoTopupState, FormData>(
    saveAutoTopupSettings,
    null,
  );

  return (
    <Card className="flex flex-col gap-stack-md">
      <form action={formAction} className="flex flex-col gap-stack-md">
        <label className="flex items-center justify-between">
          <span className="text-body-lg font-medium text-on-surface">Enable Auto Top-up</span>
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-5 accent-primary"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-body-md font-medium text-on-surface">Top up when balance falls below</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body-md text-on-surface-variant">
              $
            </span>
            <input
              name="threshold"
              type="number"
              min="0.01"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="20.00"
              className="w-full rounded-lg border border-border-light bg-surface-container-low py-2 pl-7 pr-3 text-body-lg text-on-surface outline-none focus:border-primary"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-body-md font-medium text-on-surface">Top-up amount</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body-md text-on-surface-variant">
              $
            </span>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50.00"
              className="w-full rounded-lg border border-border-light bg-surface-container-low py-2 pl-7 pr-3 text-body-lg text-on-surface outline-none focus:border-primary"
            />
          </div>
        </label>

        {state?.error ? <p className="text-body-md text-error">{state.error}</p> : null}
        {state?.ok ? <p className="text-body-md text-success-green">Saved.</p> : null}

        <Button type="submit" disabled={pending} className="justify-center">
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
    </Card>
  );
}
