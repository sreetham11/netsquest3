"use client";

// Mirrors src/app/pay/ScanPay.tsx's structure and interaction pattern, but
// "Confirm & Pay" is a client-side-only transition to the mock success page
// — no server action, nothing written anywhere. Never imports makePayment.
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";

const RECENT_MERCHANTS: Array<{ name: string; category: string; icon: IconName }> = [
  { name: "FairPrice", category: "Groceries", icon: "grocery" },
  { name: "Kopitiam", category: "Food", icon: "fast-food" },
  { name: "Cheers", category: "Shopping", icon: "convenience" },
  { name: "Toast Box", category: "Food", icon: "coffee" },
];

type Step = "scan" | "confirm";

export function PreviewScanPay() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("scan");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("Shopping");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function pickMerchant(m: (typeof RECENT_MERCHANTS)[number]) {
    setMerchant(m.name);
    setCategory(m.category);
    setStep("confirm");
  }

  function simulateUpload() {
    setMerchant("");
    setCategory("Shopping");
    setStep("confirm");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Visual-only: no server action, nothing persisted. A brief "submitting"
    // state before navigating just mirrors the real flow's feel — but the
    // success page still needs what was actually typed here, since it has no
    // other source of truth (no server action, no prisma) to read it back
    // from. Passed via URL search params rather than router/component state,
    // since /preview/pay/success is a separate page navigation.
    setSubmitting(true);
    const amountCents = Math.round((Number(amount) || 0) * 100);
    const params = new URLSearchParams({
      merchant: merchant.trim(),
      category,
      amount: String(amountCents),
    });
    setTimeout(() => router.push(`/preview/pay/success?${params.toString()}`), 400);
  }

  if (step === "confirm") {
    const amountCents = Math.round((Number(amount) || 0) * 100);
    const canSubmit = merchant.trim().length > 0 && amountCents > 0;

    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="flex items-center gap-2 px-margin-mobile py-4">
          <button
            type="button"
            onClick={() => setStep("scan")}
            aria-label="Back to scan"
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface hover:bg-surface-container"
          >
            <Icon name="chevron-left" size={22} />
          </button>
          <h1 className="text-headline-md text-on-surface">Confirm payment</h1>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-stack-md px-margin-mobile pb-24">
          <label className="flex flex-col gap-1.5">
            <span className="text-body-md font-medium text-on-surface">Paying</span>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Merchant name"
              required
              className="rounded-lg border border-border-light bg-surface-container-lowest px-3 py-2.5 text-body-lg text-on-surface outline-none focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-body-md font-medium text-on-surface">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-border-light bg-surface-container-lowest px-3 py-2.5 text-body-lg text-on-surface outline-none focus:border-primary"
            >
              {["Food", "Groceries", "Shopping", "Transport", "Entertainment", "Utilities", "Other"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-body-md font-medium text-on-surface">Amount</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-title-lg text-on-surface-variant">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                autoFocus
                className="w-full rounded-lg border border-border-light bg-surface-container-lowest py-2.5 pl-8 pr-3 text-currency-display text-on-surface outline-none focus:border-primary"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="mt-auto flex min-h-14 items-center justify-center rounded-lg bg-gradient-to-r from-nets-blue-gradient-start to-primary text-title-lg font-bold text-on-primary disabled:opacity-60"
          >
            {submitting ? "Paying…" : "Confirm & Pay"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-inverse-surface text-inverse-on-surface">
      <header className="flex items-center justify-between px-margin-mobile py-4">
        <Link href="/preview/home" aria-label="Back to Home" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
          <Icon name="chevron-left" size={22} />
        </Link>
        <h1 className="text-headline-md">Scan &amp; Pay</h1>
        <button type="button" aria-label="Help" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
          <Icon name="help-circle" size={22} />
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-24">
        <p className="text-center text-title-lg opacity-90">Align QR code within the frame to scan</p>
        <div className="h-64 w-64 rounded-lg border border-white/20 bg-white/5" />
        <div className="flex gap-4">
          <button type="button" onClick={simulateUpload} className="flex items-center gap-2 rounded-full bg-surface-container-lowest px-5 py-3 text-body-lg font-medium text-primary shadow-card">
            <Icon name="gallery" size={18} />
            Upload QR
          </button>
          <button type="button" className="flex items-center gap-2 rounded-full bg-surface-container-lowest px-5 py-3 text-body-lg font-medium text-primary shadow-card">
            <Icon name="flashlight" size={18} />
            Flashlight
          </button>
        </div>
      </div>

      <div className="rounded-t-xl bg-surface-container-lowest px-margin-mobile pb-24 pt-6 text-on-surface">
        <h2 className="mb-4 text-title-lg">Recent Merchants</h2>
        <div className="flex gap-6 overflow-x-auto pb-1">
          {RECENT_MERCHANTS.map((m) => (
            <button key={m.name} type="button" onClick={() => pickMerchant(m)} className="flex shrink-0 flex-col items-center gap-2">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon name={m.icon} size={24} />
              </span>
              <span className="text-label-md font-medium text-on-surface">{m.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
