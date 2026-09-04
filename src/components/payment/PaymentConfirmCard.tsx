"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format";

// The ONE confirm-a-payment card in this app — originally built for Scan &
// Pay (src/app/(app)/pay/PayForm.tsx), extracted here so any other flow that
// needs to confirm a payment against the NETS Prepaid wallet (e.g. AI Deal
// Finder's mock checkout) reuses this exact UI instead of a second copy.
// Purely presentational: the caller owns what "confirm" actually does
// (which Server Action, if any, it calls).
export function PaymentConfirmCard({
  payTo,
  amountCents,
  balanceCents,
  currency = "SGD",
  pending,
  error,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: {
  payTo: string;
  amountCents: number;
  balanceCents: number;
  currency?: string;
  pending: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Pay to</p>
          <p className="text-base font-semibold text-ink">{payTo}</p>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Pay using</span>
            <span className="font-medium text-ink">NETS Prepaid Card</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Total Amount</span>
            <span className="font-semibold text-ink">{formatMoney(amountCents, currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Balance after payment</span>
            <span className="font-medium text-ink">
              {formatMoney(balanceCents - amountCents, currency)}
            </span>
          </div>
        </div>

        <p className="text-xs text-ink-muted">Please check the details before confirming.</p>

        {error ? <p className="text-sm text-danger-strong">{error}</p> : null}

        <div className="flex gap-2">
          <Button
            type="button"
            onClick={onConfirm}
            loading={pending}
            className="flex-1 justify-center"
          >
            {pending ? "Confirming…" : confirmLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 justify-center"
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}
