"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import QrScanner from "qr-scanner";
import { Icon, type IconName } from "@/components/Icon";
import { BottomNav } from "@/components/BottomNav";
import { makePayment, type MakePaymentState } from "@/app/(app)/actions";
import { parseNetsQrPayload } from "@/lib/qrPayload";
import { formatMoney } from "@/lib/format";

// Category values a scanned QR's payload might name — snapped to one of the
// confirm screen's own <select> options (falling back to "Shopping") so a
// scanned category always matches a real option instead of silently
// desyncing the controlled <select> from its value.
const KNOWN_CATEGORIES = ["Food", "Groceries", "Shopping", "Transport", "Entertainment", "Utilities", "Other"];

type CameraStatus = "checking" | "active" | "unavailable";

// Fixed demo list, not real merchant-history tracking — same "static demo
// catalogue" pattern as MerchantDeal elsewhere in this app. Categories stay
// inside the app's existing BUDGET_CATEGORIES vocabulary (Food/Groceries/
// Shopping/...) so Pay-flow spend shows up correctly in Budget and Monthly
// Insights, not as an unrecognized category.
const RECENT_MERCHANTS: Array<{ name: string; category: string; icon: IconName }> = [
  { name: "FairPrice", category: "Groceries", icon: "grocery" },
  { name: "Kopitiam", category: "Food", icon: "fast-food" },
  { name: "Cheers", category: "Shopping", icon: "convenience" },
  { name: "Toast Box", category: "Food", icon: "coffee" },
];

type Step = "scan" | "confirm";

// Minimum prior real payments before the advisory ever compares against
// them — under this, "unusual for you" isn't a real claim yet (a brand-new
// account's first payment can't be an outlier relative to nothing).
const MIN_HISTORY_FOR_ADVISORY = 5;
const OUTLIER_STD_DEVS = 2;

export function ScanPay({
  spendingStats,
}: {
  // Simple mean/stddev of the user's recent real payments (see
  // getRecentPaymentStats) — an honest statistical comparison, not any real
  // fraud/anomaly detection. Purely advisory: see isUnusualAmount below.
  spendingStats: { count: number; meanCents: number; stdDevCents: number };
}) {
  const [step, setStep] = useState<Step>("scan");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("Shopping");
  const [amount, setAmount] = useState("");
  const [advisoryDismissed, setAdvisoryDismissed] = useState(false);
  const [state, formAction, pending] = useActionState<MakePaymentState, FormData>(
    makePayment,
    null,
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("checking");
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  function pickMerchant(m: (typeof RECENT_MERCHANTS)[number]) {
    setMerchant(m.name);
    setCategory(m.category);
    setStep("confirm");
  }

  // Upload QR stays a manual-entry fallback, same as before real camera
  // scanning existed — decoding a QR out of an uploaded gallery image is a
  // further step beyond live camera scanning and isn't part of this pass.
  // This just moves to the confirm step with an empty, editable merchant
  // field, so it also works as a no-camera / permission-denied escape hatch.
  function simulateUpload() {
    setMerchant("");
    setCategory("Shopping");
    setStep("confirm");
  }

  // Fires on ANY successfully-decoded QR code, regardless of content — a
  // wifi QR, a URL, a random poster code all decode fine as far as the
  // camera/scanner is concerned. parseNetsQrPayload is what actually decides
  // "is this ours", so garbage payloads fail here, not silently downstream.
  function handleDecode(raw: string) {
    scannerRef.current?.stop();
    const payload = parseNetsQrPayload(raw);
    if (!payload) {
      setScanError("This doesn't look like a NETS QR code.");
      return;
    }
    setMerchant(payload.merchant);
    setCategory(KNOWN_CATEGORIES.includes(payload.category) ? payload.category : "Shopping");
    setAmount((payload.amountCents / 100).toFixed(2));
    setStep("confirm");
  }

  // Explicit reset (rather than relying on the scan effect to clean up stale
  // state) — without it, leaving and re-entering the scan step would briefly
  // show the previous visit's error message or camera status before the new
  // scanner finishes (re)initializing.
  function backToScan() {
    setCameraStatus("checking");
    setScanError(null);
    setHasFlash(false);
    setFlashOn(false);
    setStep("scan");
  }

  function retryScan() {
    setScanError(null);
    scannerRef.current?.start().catch(() => setCameraStatus("unavailable"));
  }

  async function toggleFlash() {
    try {
      await scannerRef.current?.toggleFlash();
      setFlashOn(scannerRef.current?.isFlashOn() ?? false);
    } catch {
      // Flash toggle can fail on some devices mid-session — not worth
      // surfacing as an error, the button just stays in its current state.
    }
  }

  // Runs only while the scan step is showing, so the camera stream is never
  // held open behind the confirm form or after leaving this page — start on
  // mount, and the cleanup (return below) stops+destroys on every exit path
  // (step change or unmount) so nothing leaks the camera stream.
  useEffect(() => {
    if (step !== "scan") return;
    let cancelled = false;
    let scanner: QrScanner | null = null;

    async function init() {
      const cameraAvailable = await QrScanner.hasCamera().catch(() => false);
      if (cancelled) return;
      if (!cameraAvailable || !videoRef.current) {
        setCameraStatus("unavailable");
        return;
      }

      scanner = new QrScanner(videoRef.current, (result) => handleDecode(result.data), {
        // Fires continuously whenever no code is in frame — expected noise,
        // not a real failure, so this stays a no-op.
        onDecodeError: () => {},
        highlightScanRegion: true,
        highlightCodeOutline: true,
        preferredCamera: "environment",
      });
      scannerRef.current = scanner;

      try {
        await scanner.start();
        if (cancelled) {
          scanner.destroy();
          return;
        }
        setCameraStatus("active");
        const flash = await scanner.hasFlash().catch(() => false);
        if (!cancelled) setHasFlash(flash);
      } catch {
        // getUserMedia rejected — permission denied, no camera hardware, or
        // insecure context. Either way, fall back to the manual paths below
        // rather than leaving a stuck "Starting camera…" screen.
        if (!cancelled) setCameraStatus("unavailable");
      }
    }

    void init();

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
      scannerRef.current = null;
    };
  }, [step]);

  if (step === "confirm") {
    const amountCents = Math.round((Number(amount) || 0) * 100);
    const canSubmit = merchant.trim().length > 0 && amountCents > 0;
    // stdDevCents > 0 guard: with zero variance in the history (e.g. every
    // prior payment happened to be exactly the same amount), "mean + 2*SD"
    // collapses to just "mean", which would flag ANY different amount —
    // not a real signal, just a degenerate case of too-uniform history.
    const isUnusualAmount =
      spendingStats.count >= MIN_HISTORY_FOR_ADVISORY &&
      spendingStats.stdDevCents > 0 &&
      amountCents > spendingStats.meanCents + OUTLIER_STD_DEVS * spendingStats.stdDevCents;

    return (
      <div className="flex min-h-screen flex-col bg-background">
        {/* Same mx-auto/max-w-3xl containment AppShell's own <main> uses for
            every (app) route — this page lives outside that layout (see the
            comment below), so it isn't inherited automatically, but the
            constraint itself is the same one, not a new approach. Without
            it this form stretched full-bleed on desktop. */}
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          <header className="flex items-center gap-2 px-margin-mobile py-4">
            <button
              type="button"
              onClick={backToScan}
              aria-label="Back to scan"
              className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface hover:bg-surface-container"
            >
              <Icon name="chevron-left" size={22} />
            </button>
            <h1 className="text-headline-md text-on-surface">Confirm payment</h1>
          </header>

          <form action={formAction} className="flex flex-1 flex-col gap-stack-md px-margin-mobile pb-24 sm:max-w-md">
            <input type="hidden" name="category" value={category} />

          <label className="flex flex-col gap-1.5">
            <span className="text-body-md font-medium text-on-surface">Paying</span>
            <input
              name="merchant"
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
              {["Food", "Groceries", "Shopping", "Transport", "Entertainment", "Utilities", "Other"].map(
                (c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-body-md font-medium text-on-surface">Amount</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-title-lg text-on-surface-variant">
                $
              </span>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setAdvisoryDismissed(false);
                }}
                placeholder="0.00"
                required
                autoFocus
                className="w-full rounded-lg border border-border-light bg-surface-container-lowest py-2.5 pl-8 pr-3 text-currency-display text-on-surface outline-none focus:border-primary"
              />
            </div>
          </label>

            {/* Advisory only — a genuine statistical comparison against this
                user's own history ("unusually large for you"), explicitly
                NOT framed as fraud/security detection, and never blocks
                submission. Dismissible; re-appears if the amount changes
                again since that's a new number worth a fresh look. */}
            {isUnusualAmount && !advisoryDismissed ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-gold-tier/40 bg-gold-tier/5 p-3">
                <Icon name="help-circle" size={18} className="mt-0.5 shrink-0 text-gold-tier" />
                <div className="flex-1">
                  <p className="text-body-md font-medium text-on-surface">This is unusually large for you</p>
                  <p className="mt-0.5 text-label-md text-on-surface-variant">
                    Your recent NETS payments have averaged about {formatMoney(spendingStats.meanCents)}. Just a
                    heads-up — this won&apos;t stop your payment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdvisoryDismissed(true)}
                  aria-label="Dismiss"
                  className="shrink-0 text-on-surface-variant hover:text-on-surface"
                >
                  <Icon name="plus" size={16} className="rotate-45" />
                </button>
              </div>
            ) : null}

            {state?.error ? <p className="text-body-md text-error">{state.error}</p> : null}

            <button
              type="submit"
              disabled={!canSubmit || pending}
              className="mt-auto flex min-h-14 items-center justify-center rounded-lg bg-gradient-to-r from-nets-blue-gradient-start to-primary text-title-lg font-bold text-on-primary disabled:opacity-60"
            >
              {pending ? "Paying…" : "Confirm & Pay"}
            </button>
          </form>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-inverse-surface text-inverse-on-surface">
      {/* Custom top chrome, per scan_pay/screen.png — the standard AppShell
          header (brand + sign out) doesn't fit a full-bleed dark scanner
          view, so this page renders outside (app)/ and builds its own. The
          dark background stays full-bleed (looks intentional, matches the
          screen), but the CONTENT gets the same mx-auto/max-w-3xl
          containment every (app) route uses, via AppShell's <main> — without
          it the viewfinder and merchant sheet stretched edge-to-edge on a
          wide desktop window, which nothing here was ever designed for. */}
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <header className="flex items-center justify-between px-margin-mobile py-4">
          <Link
            href="/home"
            aria-label="Back to Home"
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
          >
            <Icon name="chevron-left" size={22} />
          </Link>
          <h1 className="text-headline-md">Scan &amp; Pay</h1>
          {/* Inert — no help content system exists yet, same treatment as
              Activity's Export PDF/Filters buttons in the earlier phase. */}
          <button
            type="button"
            aria-label="Help"
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
          >
            <Icon name="help-circle" size={22} />
          </button>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-24">
          <p className="text-center text-title-lg opacity-90">
            {cameraStatus === "unavailable"
              ? "Camera unavailable — use Upload QR or pick a merchant below"
              : "Align QR code within the frame to scan"}
          </p>
          {/* Single stable <video> node across every camera state — qr-scanner
              attaches the stream to this exact element, so it can't be
              swapped for a different element per branch (which would break
              the attachment). Visibility instead toggles via opacity, with
              the "checking"/"unavailable"/error states layered on top. */}
          <div className="relative h-64 w-64 overflow-hidden rounded-lg border border-white/20 bg-white/5 sm:h-80 sm:w-80">
            <video
              ref={videoRef}
              muted
              playsInline
              className={
                "absolute inset-0 h-full w-full object-cover " +
                (cameraStatus === "active" ? "" : "opacity-0")
              }
            />
            {cameraStatus === "checking" && (
              <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-body-md opacity-80">
                Starting camera…
              </p>
            )}
            {cameraStatus === "unavailable" && (
              <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-body-md opacity-80">
                No camera found on this device.
              </p>
            )}
            {scanError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-inverse-surface/95 px-4 text-center">
                <p className="text-body-md">{scanError}</p>
                <button
                  type="button"
                  onClick={retryScan}
                  className="rounded-full bg-primary px-5 py-2.5 text-label-md font-semibold text-on-primary"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={simulateUpload}
              className="flex items-center gap-2 rounded-full bg-surface-container-lowest px-5 py-3 text-body-lg font-medium text-primary shadow-card"
            >
              <Icon name="gallery" size={18} />
              Upload QR
            </button>
            {/* Only shown once the active scanner confirms this device
                actually has a torch — no dead button on devices/desktops
                that don't. */}
            {hasFlash && (
              <button
                type="button"
                onClick={toggleFlash}
                className="flex items-center gap-2 rounded-full bg-surface-container-lowest px-5 py-3 text-body-lg font-medium text-primary shadow-card"
              >
                <Icon name="flashlight" size={18} />
                {flashOn ? "Flash On" : "Flashlight"}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-t-xl bg-surface-container-lowest px-margin-mobile pb-24 pt-6 text-on-surface">
          <h2 className="mb-4 text-title-lg">Recent Merchants</h2>
          <div className="flex gap-6 overflow-x-auto pb-1">
            {RECENT_MERCHANTS.map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => pickMerchant(m)}
                className="flex shrink-0 flex-col items-center gap-2"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon name={m.icon} size={24} />
                </span>
                <span className="text-label-md font-medium text-on-surface">{m.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
