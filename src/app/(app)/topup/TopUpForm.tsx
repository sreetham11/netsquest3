"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/lib/format";
import { topUp } from "../actions";

// How long the success confirmation stays up before the form returns to its
// normal state. The balance itself is already updated behind it (topUp
// revalidates /home), so this is purely the "it worked" beat.
const SUCCESS_MS = 3000;

type Step = "amount" | "confirm" | "success";

// Enter amount -> confirm -> success, matching how the real NETS app makes you
// acknowledge a top-up instead of silently moving money.
//
// This is a UI layer ONLY: it calls the existing topUp Server Action with the
// same `amount` field the plain form submitted before, and neither the action
// nor any balance logic is touched.
export function TopUpForm({
  balanceCents,
  currency,
}: {
  balanceCents: number;
  currency: string;
}) {
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("amount");
  const [pending, startTransition] = useTransition();
  // Captured at confirm time so the success line can state the resulting
  // balance without re-reading a prop that revalidation has already moved.
  const [newBalanceCents, setNewBalanceCents] = useState(0);

  const amountCents = Math.round((Number(amount) || 0) * 100);
  // Same guard the Server Action applies, so the button can't offer a
  // confirmation the action would silently reject.
  const valid = Number.isFinite(amountCents) && amountCents > 0;

  useEffect(() => {
    if (step !== "success") return;
    const timer = setTimeout(() => setStep("amount"), SUCCESS_MS);
    return () => clearTimeout(timer);
  }, [step]);

  function confirmTopUp() {
    if (!valid) return;
    const balanceBefore = balanceCents;
    const formData = new FormData();
    formData.append("amount", amount);

    startTransition(async () => {
      await topUp(formData);
      setNewBalanceCents(balanceBefore + amountCents);
      setAmount("");
      setStep("success");
    });
  }

  if (step === "success") {
    return (
      <div className="flex items-center gap-3 rounded-button bg-nets-blue-100 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white">
          <Icon name="check" size={16} />
        </span>
        <p className="text-sm font-medium text-accent">
          Top-up successful — new balance {formatMoney(newBalanceCents, currency)}
        </p>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="flex flex-col gap-3 rounded-button border border-line bg-surface p-4">
        <p className="text-sm font-medium text-ink">
          Add {formatMoney(amountCents, currency)} to your balance?
        </p>
        <p className="text-sm text-ink-muted">
          New balance will be {formatMoney(balanceCents + amountCents, currency)}.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={confirmTopUp}
            disabled={pending}
            className="flex-1 justify-center"
          >
            {pending ? "Adding…" : "Confirm"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep("amount")}
            disabled={pending}
            className="flex-1 justify-center"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
          $
        </span>
        <input
          name="amount"
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Top up amount"
          className="w-full rounded-button border border-line bg-surface py-2 pl-7 pr-3 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-accent"
        />
      </div>
      <Button
        type="button"
        onClick={() => setStep("confirm")}
        disabled={!valid}
        className="w-full justify-center"
      >
        Top up
      </Button>
    </div>
  );
}
