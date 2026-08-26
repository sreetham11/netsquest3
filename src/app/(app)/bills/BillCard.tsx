"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { formatMoney, formatDayMonth } from "@/lib/format";
import { payBill, type PayBillState } from "../actions";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function BillCard({
  bill,
  currency,
  paidThisMonth,
}: {
  bill: {
    id: string;
    name: string;
    category: string;
    amountCents: number;
    dueDayOfMonth: number;
    autopay: boolean;
    lastPaidAt: Date | null;
  };
  currency: string;
  paidThisMonth: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<PayBillState, FormData>(payBill, null);

  // No effect needed to collapse the confirm form on success: once payBill
  // succeeds, revalidatePath("/bills") re-renders this card with
  // paidThisMonth=true from the server, which already gates the form below —
  // `confirming` staying stale/true internally is harmless and never surfaces.

  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
          <Icon name="bills" size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{bill.name}</p>
          <p className="truncate text-sm text-ink-muted">
            Due {ordinal(bill.dueDayOfMonth)} · {bill.category}
            {bill.autopay ? " · Autopay on" : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-sm font-semibold text-ink">
            {formatMoney(bill.amountCents, currency)}
          </span>
          {paidThisMonth ? (
            // A completed record, not an action — plain text, not a link/button.
            <span className="text-xs font-medium text-ink-muted">
              Paid {formatMoney(bill.amountCents, currency)} on{" "}
              {bill.lastPaidAt ? formatDayMonth(bill.lastPaidAt) : "—"}
            </span>
          ) : !confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-button bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-strong"
            >
              Pay now
            </button>
          ) : null}
        </div>
      </div>

      {!paidThisMonth && confirming ? (
        <form action={formAction} className="mt-4 border-t border-line pt-4">
          <input type="hidden" name="billId" value={bill.id} />
          <p className="text-sm text-ink">
            Pay <span className="font-semibold">{formatMoney(bill.amountCents, currency)}</span>{" "}
            for {bill.name} from your NETS balance?
          </p>
          {state?.error ? <p className="mt-2 text-sm text-danger-strong">{state.error}</p> : null}
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={pending} className="flex-1 justify-center">
              {pending ? "Paying…" : "Confirm payment"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
