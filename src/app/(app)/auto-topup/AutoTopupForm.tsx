"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Icon } from "@/components/Icon";
import { saveAutoTopupSettings } from "../actions";

// Fixed quick-pick amounts, same "static demo presets" convention as
// TopUpForm's PRESET_AMOUNTS — not fetched from anywhere.
const THRESHOLD_PRESETS = [10, 20, 30];
const AMOUNT_PRESETS = [30, 40, 50];

type FieldMode = "preset" | "custom";

// One preset-buttons-plus-custom-fallback field, shared by the threshold and
// amount rows below — same control shape twice, so it's pulled out once
// rather than duplicated. Purely a UI/input-pattern component: it has no
// idea what the numbers mean or how they're validated, that stays in
// AutoTopupForm.
function PresetAmountField({
  label,
  presets,
  value,
  onValueChange,
  mode,
  onModeChange,
  disabledPresets,
  hint,
}: {
  label: string;
  presets: number[];
  value: string;
  onValueChange: (v: string) => void;
  mode: FieldMode;
  onModeChange: (m: FieldMode) => void;
  disabledPresets: Set<number>;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="grid grid-cols-4 gap-2">
        {presets.map((preset) => {
          const selected = mode === "preset" && value === String(preset);
          const disabled = disabledPresets.has(preset);
          return (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => {
                onModeChange("preset");
                onValueChange(String(preset));
              }}
              className={
                "rounded-button border px-2 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
                (selected
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-surface text-ink hover:bg-surface-muted")
              }
            >
              ${preset}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onModeChange("custom")}
          className={
            "rounded-button border px-2 py-2.5 text-sm font-medium transition-colors " +
            (mode === "custom"
              ? "border-accent bg-accent text-white"
              : "border-line bg-surface text-ink hover:bg-surface-muted")
          }
        >
          Custom
        </button>
      </div>

      {mode === "custom" ? (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
            $
          </span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            autoFocus
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-button border border-line bg-surface py-2 pl-7 pr-3 text-sm text-ink outline-none focus:border-accent"
          />
        </div>
      ) : null}

      {hint}
    </div>
  );
}

// Local edit state mirrors what's saved, seeded from the account row. The
// custom Toggle isn't a real <input>, so its on/off state is bridged into
// FormData manually (only appended when true) to match the same
// `formData.get("enabled") === "on"` convention a real checkbox would submit
// — saveAutoTopupSettings doesn't know or care that this isn't a real form.
//
// threshold/amount are still plain dollar strings fed into the same
// FormData shape as before — only the input WIDGET changed (preset buttons
// instead of a bare text field), not what gets sent to the Server Action.
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
  // Starts in "custom" mode only when there's an actual saved value that
  // doesn't match any preset (e.g. an old free-text value like $25), so it's
  // shown rather than silently hidden behind a preset row that doesn't
  // reflect it. No saved value at all (a fresh account) defaults to
  // "preset" — the primary path — not custom.
  const [thresholdMode, setThresholdMode] = useState<FieldMode>(
    initialThresholdCents != null && !THRESHOLD_PRESETS.includes(initialThresholdCents / 100)
      ? "custom"
      : "preset",
  );
  const [amountMode, setAmountMode] = useState<FieldMode>(
    initialAmountCents != null && !AMOUNT_PRESETS.includes(initialAmountCents / 100)
      ? "custom"
      : "preset",
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const thresholdCents = Math.round((Number(threshold) || 0) * 100);
  const amountCents = Math.round((Number(amount) || 0) * 100);
  // Same rule the Server Action enforces (a top-up can't immediately
  // re-trigger itself) — surfaced here live so a bad combination is caught
  // before Save, not just rejected after.
  const violatesOrder = amountCents > 0 && thresholdCents > 0 && amountCents <= thresholdCents;

  // Presets that would violate the rule against whatever's currently picked
  // on the OTHER row are disabled rather than silently accepted then
  // rejected on Save.
  const disabledAmountPresets = new Set(
    thresholdCents > 0 ? AMOUNT_PRESETS.filter((p) => p * 100 <= thresholdCents) : [],
  );
  const disabledThresholdPresets = new Set(
    amountCents > 0 ? THRESHOLD_PRESETS.filter((p) => p * 100 >= amountCents) : [],
  );

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

      <div className="mt-5">
        <PresetAmountField
          label="Top up when balance falls below"
          presets={THRESHOLD_PRESETS}
          value={threshold}
          onValueChange={setThreshold}
          mode={thresholdMode}
          onModeChange={setThresholdMode}
          disabledPresets={disabledThresholdPresets}
        />
      </div>

      <div className="mt-4">
        <PresetAmountField
          label="Top up by"
          presets={AMOUNT_PRESETS}
          value={amount}
          onValueChange={setAmount}
          mode={amountMode}
          onModeChange={setAmountMode}
          disabledPresets={disabledAmountPresets}
          hint={
            violatesOrder ? (
              <span className="text-xs text-danger-strong">
                Top-up amount must be more than the threshold above.
              </span>
            ) : (
              <span className="text-xs text-ink-muted">
                Must be more than the threshold above, so one top-up can&apos;t immediately
                trigger another.
              </span>
            )
          }
        />
      </div>

      {error ? <p className="mt-3 text-sm text-danger-strong">{error}</p> : null}
      {saved && !error ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-success">
          <Icon name="check" size={14} />
          Saved.
        </p>
      ) : null}

      <Button
        type="button"
        onClick={save}
        loading={pending}
        disabled={enabled && violatesOrder}
        className="mt-5 w-full justify-center"
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </Card>
  );
}
