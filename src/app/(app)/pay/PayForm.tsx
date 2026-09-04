"use client";

import { useState, useTransition } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { CompassMark } from "@/components/CompassMark";
import { PaymentConfirmCard } from "@/components/payment/PaymentConfirmCard";
import { PaymentSuccessCard } from "@/components/payment/PaymentSuccessCard";
import { formatMoney } from "@/lib/format";
import { randomTransactionRef } from "@/lib/payment";
import { splitPrefillHref } from "@/lib/txn";
import { makePayment } from "../actions";

type Step = "qr" | "amount" | "confirm" | "success";

// Fixed demo merchant identity for the scan path — this app has no live
// camera/QR reader, so "scanning" the branded demo code below always
// resolves to this same merchant. "Simulate Scan" is the only way through
// this screen — no manual-entry fallback (removed: a different, real
// merchant name was never a thing this demo could actually verify).
const DEFAULT_MERCHANT = "Merchant ABC";

// No real category picker in this flow (the old merchant-tile grid carried
// one implicitly via which tile you tapped) — a single fixed demo merchant
// doesn't need one, so every scan-and-pay payment lands in the same
// catch-all category, same default makePayment already falls back to.
const DEFAULT_CATEGORY = "Shopping";

// Encoded string for the demo QR — any simple payload works since nothing
// ever decodes it for real; it just needs to look like a real merchant QR
// would (a merchant identifier), not be functional.
const DEMO_QR_VALUE = "netsquest://pay?merchant=demo-merchant-abc";

// Uses useTransition + a direct action call (same pattern as TopUpForm and
// AddContactForm) rather than useActionState — the success state needs to
// be set right where the result is known, not from a post-render effect.
export function PayForm({
  balanceCents,
  currency,
  fromSplit = false,
}: {
  balanceCents: number;
  currency: string;
  // True only when this Scan & Pay session was launched from Split's own
  // button (see split/page.tsx's `?from=split` and pay/page.tsx) — gates the
  // "Split this?" prompt on the success screen. The bottom nav's own entry
  // point never sets this, so a normal payment stays exactly as before.
  fromSplit?: boolean;
}) {
  const [step, setStep] = useState<Step>("qr");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ newBalanceCents: number; pointsEarned: number } | null>(
    null,
  );
  const [successAt, setSuccessAt] = useState<Date | null>(null);
  const [txnRef, setTxnRef] = useState("");
  const [pending, startTransition] = useTransition();

  const amountCents = Math.round((Number(amount) || 0) * 100);
  const validAmount = Number.isFinite(amountCents) && amountCents > 0;
  const insufficient = amountCents > balanceCents;

  function simulateScan() {
    setAmount("");
    setStep("amount");
  }

  function payAgain() {
    setAmount("");
    setError("");
    setResult(null);
    setSuccessAt(null);
    setTxnRef("");
    setStep("qr");
  }

  function confirmPayment() {
    if (!validAmount || insufficient) return;
    setError("");
    const formData = new FormData();
    formData.append("merchant", DEFAULT_MERCHANT);
    formData.append("category", DEFAULT_CATEGORY);
    formData.append("amount", amount);

    startTransition(async () => {
      const state = await makePayment(null, formData);
      if (!state?.ok) {
        setError(state?.error ?? "Couldn't complete this payment. Try again.");
        return;
      }
      setResult({ newBalanceCents: state.newBalanceCents, pointsEarned: state.pointsEarned });
      setSuccessAt(new Date());
      setTxnRef(randomTransactionRef());
      setStep("success");
    });
  }

  if (step === "success" && result && successAt) {
    return (
      <PaymentSuccessCard
        merchant={DEFAULT_MERCHANT}
        amountCents={amountCents}
        currency={currency}
        successAt={successAt}
        txnRef={txnRef}
        pointsEarned={result.pointsEarned}
        onAgain={payAgain}
        splitPromptHref={
          fromSplit ? splitPrefillHref(DEFAULT_MERCHANT, amountCents, DEFAULT_CATEGORY) : undefined
        }
      />
    );
  }

  if (step === "confirm") {
    return (
      <PaymentConfirmCard
        payTo={DEFAULT_MERCHANT}
        amountCents={amountCents}
        balanceCents={balanceCents}
        currency={currency}
        pending={pending}
        error={error}
        onConfirm={confirmPayment}
        onCancel={() => setStep("amount")}
      />
    );
  }

  if (step === "amount") {
    return (
      <Card>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Pay to</p>
            <p className="text-base font-semibold text-ink">{DEFAULT_MERCHANT}</p>
          </div>

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
                autoFocus
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

          <div className="flex items-center justify-between rounded-button border border-line bg-surface-muted px-3 py-2 text-xs">
            <span className="text-ink-muted">Pay using NETS Prepaid Card</span>
            <span className="font-medium text-ink">{formatMoney(balanceCents, currency)}</span>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => setStep("confirm")}
              disabled={!validAmount || insufficient}
              className="flex-1 justify-center"
            >
              Submit
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep("qr")}
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
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-ink-muted">
        Point your camera at a merchant&apos;s QR code to pay.
      </p>

      {/* Branded demo QR — our compass mark + wordmark, not a real bank/
          fintech logo (no DBS/UOB/GrabPay etc., since we hold no real
          certification with any of them). "Simulate Scan" stands in for an
          actual camera scan, which this app doesn't have. */}
      <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-white p-6 shadow-sm">
        <CompassMark size={36} />
        <div className="rounded-lg border border-line p-3">
          <QRCodeSVG value={DEMO_QR_VALUE} size={168} bgColor="#ffffff" fgColor="#0b1426" />
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Demo Merchant QR
        </p>
      </div>

      <Button type="button" onClick={simulateScan} className="w-full justify-center">
        <Icon name="camera" size={16} />
        Simulate Scan
      </Button>
    </div>
  );
}
