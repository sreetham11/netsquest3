"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { redeemCashback, type RedeemCashbackState } from "../actions";

// Redemption path #2 — points straight into the wallet balance. Rates are
// passed in from the server (rewards.ts is server-only) so this form never
// hardcodes an exchange rate of its own; the Server Action re-validates and
// floors to whole dollars regardless of what is typed here.
export function CashbackForm({
  pointsBalance,
  pointsPerDollar,
}: {
  pointsBalance: number;
  pointsPerDollar: number;
}) {
  const [points, setPoints] = useState("");
  const [state, formAction, pending] = useActionState<RedeemCashbackState, FormData>(
    redeemCashback,
    null,
  );

  const requested = Math.floor(Number(points) || 0);
  const dollars = Math.floor(requested / pointsPerDollar);
  const affordable = requested > 0 && requested <= pointsBalance;
  const canSubmit = dollars > 0 && affordable;

  const maxRedeemable = Math.floor(pointsBalance / pointsPerDollar) * pointsPerDollar;

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Points to redeem</span>
        <input
          name="points"
          type="number"
          min={pointsPerDollar}
          step={pointsPerDollar}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          placeholder={String(pointsPerDollar)}
          className="w-full rounded-button border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent"
        />
        <span className="text-xs text-ink-muted">
          {maxRedeemable > 0
            ? `Up to ${maxRedeemable.toLocaleString()} pts available · ${pointsPerDollar} pts = $1.00`
            : `Earn at least ${pointsPerDollar} pts to redeem cashback`}
        </span>
      </label>

      {requested > 0 ? (
        <p className={`text-xs ${affordable ? "text-ink-muted" : "text-danger-strong"}`}>
          {affordable
            ? `Credits $${dollars.toFixed(2)} to your wallet balance`
            : "You don't have enough points for that."}
        </p>
      ) : null}

      {state?.error ? <p className="text-sm text-danger-strong">{state.error}</p> : null}
      {state?.ok ? (
        <p className="text-sm text-accent">Cashback added to your wallet balance.</p>
      ) : null}

      <Button
        type="submit"
        disabled={!canSubmit || pending}
        className="w-full justify-center"
      >
        {pending ? "Redeeming…" : "Redeem for cashback"}
      </Button>
    </form>
  );
}
