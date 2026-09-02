"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/Icon";
import { formatMoney } from "@/lib/format";
import { BUDGET_CATEGORIES } from "@/lib/categoryIcon";
import { makePayment } from "../actions";

type Step = "choose" | "confirm" | "success";

// Fixed demo list, same "static demo catalogue" convention as MerchantDeal
// elsewhere in this app — not real merchant/location data. Categories are
// drawn from BUDGET_CATEGORIES (categoryIcon.ts's single source of truth)
// so a payment here always lands in a category Budget/Top Spending
// Categories already recognize, never an orphaned one-off string.
const QUICK_MERCHANTS: Array<{ name: string; category: string; icon: IconName }> = [
  { name: "Kopitiam", category: "Food", icon: "fast-food" },
  { name: "FairPrice", category: "Groceries", icon: "grocery" },
  { name: "Cheers", category: "Shopping", icon: "convenience" },
  { name: "Starbucks", category: "Food", icon: "coffee" },
];

// "Overseas" is a cross-cutting derived bucket (see getMonthlySpendByCategory
// — it's computed from Transaction.country, never written as a literal
// category), so it doesn't belong as a pickable category for an in-person tap.
const PAYABLE_CATEGORIES = BUDGET_CATEGORIES.filter((c) => c !== "Overseas");

// Uses useTransition + a direct action call (same pattern as TopUpForm and
// AddContactForm) rather than useActionState — the success state needs to
// be set right where the result is known, not from a post-render effect.
export function PayForm({
  balanceCents,
  currency,
}: {
  balanceCents: number;
  currency: string;
}) {
  const [step, setStep] = useState<Step>("choose");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState(PAYABLE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ newBalanceCents: number; pointsEarned: number } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const amountCents = Math.round((Number(amount) || 0) * 100);
  const valid = Number.isFinite(amountCents) && amountCents > 0 && merchant.trim().length > 0;
  const insufficient = amountCents > balanceCents;

  function pickMerchant(m: (typeof QUICK_MERCHANTS)[number]) {
    setMerchant(m.name);
    setCategory(m.category);
    setAmount("");
    setStep("confirm");
  }

  function enterManually() {
    setMerchant("");
    setCategory(PAYABLE_CATEGORIES[0]);
    setAmount("");
    setStep("confirm");
  }

  function payAgain() {
    setMerchant("");
    setCategory(PAYABLE_CATEGORIES[0]);
    setAmount("");
    setError("");
    setResult(null);
    setStep("choose");
  }

  function submitPayment() {
    if (!valid || insufficient) return;
    setError("");
    const formData = new FormData();
    formData.append("merchant", merchant);
    formData.append("category", category);
    formData.append("amount", amount);

    startTransition(async () => {
      const state = await makePayment(null, formData);
      if (!state?.ok) {
        setError(state?.error ?? "Couldn't complete this payment. Try again.");
        return;
      }
      setResult({ newBalanceCents: state.newBalanceCents, pointsEarned: state.pointsEarned });
      setStep("success");
    });
  }

  if (step === "success" && result) {
    return (
      <Card className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white">
          <Icon name="check" size={22} />
        </span>
        <div>
          <p className="text-lg font-bold text-ink">Payment successful</p>
          <p className="mt-1 text-sm text-ink-muted">
            New balance {formatMoney(result.newBalanceCents, currency)}
            {result.pointsEarned > 0
              ? ` · +${result.pointsEarned.toLocaleString()} pts earned`
              : ""}
          </p>
        </div>
        <div className="flex w-full gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={payAgain}
            className="flex-1 justify-center"
          >
            Pay again
          </Button>
          <ButtonLink href="/home" className="flex-1 justify-center">
            Done
          </ButtonLink>
        </div>
      </Card>
    );
  }

  if (step === "confirm") {
    return (
      <Card>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Paying</span>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Merchant name"
              className="rounded-button border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-button border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            >
              {PAYABLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Amount</span>
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
            {insufficient ? (
              <span className="text-xs text-danger-strong">
                That&apos;s more than your {formatMoney(balanceCents, currency)} balance.
              </span>
            ) : null}
          </label>

          {error ? <p className="text-sm text-danger-strong">{error}</p> : null}

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={submitPayment}
              disabled={!valid || insufficient || pending}
              className="flex-1 justify-center"
            >
              {pending ? "Paying…" : "Pay"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep("choose")}
              disabled={pending}
              className="flex-1 justify-center"
            >
              Back
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">Pick a merchant, or enter one manually.</p>
      <div className="grid grid-cols-2 gap-3">
        {QUICK_MERCHANTS.map((m) => (
          <button
            key={m.name}
            type="button"
            onClick={() => pickMerchant(m)}
            className="flex flex-col items-center gap-2 rounded-button border border-line bg-surface px-4 py-5 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            <Icon name={m.icon} size={22} className="text-accent" />
            {m.name}
          </button>
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={enterManually}
        className="w-full justify-center"
      >
        Enter manually
      </Button>
    </div>
  );
}
