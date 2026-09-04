"use client";

import { useEffect, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/lib/format";
import { topUp } from "../actions";
import { TopUpIntro } from "./TopUpIntro";

type Step = "intro" | "amount" | "confirm" | "success";

// How long the intro animation auto-plays before advancing to the amount
// screen — tap-to-skip (TopUpIntro's onSkip) can always cut this short.
// Matches the ~1.8s CSS animation duration (--animate-topup-card-slide) so
// it doesn't visibly cut the animation off early or leave a dead pause.
const INTRO_MS = 1800;

// Fixed quick-pick amounts shown above the custom input — round numbers a
// demo user is most likely to want, not fetched from anywhere.
const PRESET_AMOUNTS = [10, 20, 30, 40, 50];

// Enter amount -> confirm -> success, matching how the real NETS app makes you
// acknowledge a top-up instead of silently moving money.
//
// This is a UI layer ONLY: it calls the existing topUp Server Action with the
// same `amount` field the plain form submitted before, and neither the action
// nor any balance logic is touched.
export function TopUpForm({
  balanceCents,
  currency,
  accountId,
}: {
  balanceCents: number;
  currency: string;
  // The account's own id — this app stores no real card/PAN number, so the
  // success screen's "ending (XXXX)" is sourced from this existing
  // identifier rather than a fabricated card number. See payment-methods
  // page for the same "don't invent a PAN" boundary.
  accountId: string;
}) {
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("intro");
  const [pending, startTransition] = useTransition();
  // Captured at confirm time so the success line can state the amount added
  // and resulting balance without re-reading a prop that revalidation has
  // already moved.
  const [addedCents, setAddedCents] = useState(0);
  const [newBalanceCents, setNewBalanceCents] = useState(0);

  const amountCents = Math.round((Number(amount) || 0) * 100);
  // Same guard the Server Action applies, so the button can't offer a
  // confirmation the action would silently reject.
  const valid = Number.isFinite(amountCents) && amountCents > 0;
  const lastFour = accountId.slice(-4).toUpperCase();

  function confirmTopUp() {
    if (!valid) return;
    const balanceBefore = balanceCents;
    const formData = new FormData();
    formData.append("amount", amount);

    startTransition(async () => {
      await topUp(formData);
      setAddedCents(amountCents);
      setNewBalanceCents(balanceBefore + amountCents);
      setAmount("");
      setStep("success");
    });
  }

  function topUpAgain() {
    setStep("amount");
  }

  useEffect(() => {
    if (step !== "intro") return;
    const timer = setTimeout(() => setStep("amount"), INTRO_MS);
    return () => clearTimeout(timer);
  }, [step]);

  if (step === "intro") {
    return <TopUpIntro onSkip={() => setStep("amount")} />;
  }

  if (step === "success") {
    return (
      <Card className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-white">
          <Icon name="check" size={22} />
        </span>
        <div>
          <p className="text-lg font-bold text-ink">Top-up successful</p>
          <p className="mt-1 text-sm text-ink-muted">
            You&apos;ve added {formatMoney(addedCents, currency)} to your NETS Prepaid Card ending (
            {lastFour})
          </p>
        </div>
        <p className="text-sm text-ink-muted">
          New balance {formatMoney(newBalanceCents, currency)}
        </p>
        <div className="flex w-full gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={topUpAgain}
            className="flex-1 justify-center"
          >
            Top up again
          </Button>
          <ButtonLink href="/transactions" className="flex-1 justify-center">
            View in Activity
          </ButtonLink>
        </div>
      </Card>
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
            loading={pending}
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
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-ink">Top-up amount</p>
        <p className="mt-0.5 text-xs text-ink-muted">Top up from NETS Prepaid Card</p>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {PRESET_AMOUNTS.map((preset) => {
          const selected = amount === String(preset);
          return (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              className={
                "rounded-button border px-1.5 py-2.5 text-sm font-medium transition-colors " +
                (selected
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-surface text-ink hover:bg-surface-muted")
              }
            >
              ${preset}
            </button>
          );
        })}
      </div>

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
          placeholder="Custom amount"
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
