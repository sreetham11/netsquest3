"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { saveAutoTopupSettings } from "../actions";

// Local edit state mirrors what's saved, seeded from the account row. The
// custom Toggle isn't a real <input>, so its on/off state is bridged into
// FormData manually (only appended when true) to match the same
// `formData.get("enabled") === "on"` convention a real checkbox would submit
// — saveAutoTopupSettings doesn't know or care that this isn't a real form.
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
    initialThresholdCents != null ? String(initialThresholdCents / 100) : "",
  );
  const [amount, setAmount] = useState(
    initialAmountCents != null ? String(initialAmountCents / 100) : "",
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    setError("");
    setSaved(false);
    const formData = new FormData();
    if (enabled) formData.append("enabled", "on");
    formData.append("threshold", threshold);
    formData.append("amount", amount);

    startTransition(async () => {
      const result = await saveAutoTopupSettings(null, formData);
      if (!result?.ok) {
        setError(result?.error ?? "Couldn't save. Try again.");
        return;
      }
      setSaved(true);
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Enable Auto Top-up</p>
          <p className="text-sm text-ink-muted">
            Automatically top up when your balance runs low.
          </p>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} label="Enable Auto Top-up" />
      </div>

      <label className="mt-5 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Top up when balance falls below</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
            $
          </span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-button border border-line bg-surface py-2 pl-7 pr-3 text-sm text-ink outline-none focus:border-accent"
          />
        </div>
      </label>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Top up by</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
            $
          </span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-button border border-line bg-surface py-2 pl-7 pr-3 text-sm text-ink outline-none focus:border-accent"
          />
        </div>
        <span className="text-xs text-ink-muted">
          Must be more than the threshold above, so one top-up can&apos;t immediately
          trigger another.
        </span>
      </label>

      {error ? <p className="mt-3 text-sm text-danger-strong">{error}</p> : null}
      {saved && !error ? (
        <p className="mt-3 text-sm font-medium text-accent">Saved.</p>
      ) : null}

      <Button
        type="button"
        onClick={save}
        disabled={pending}
        className="mt-5 w-full justify-center"
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </Card>
  );
}
