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
  dueSoon,
  pointsBalance,
  milesDiscountCents,
  milesPointsCost,
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
  // Computed server-side (src/lib/bills.ts) from dueDayOfMonth + paidThisMonth
  // — pure display flag, not re-derived here.
  dueSoon: boolean;
  // Points on hand, the discount those points can actually cover for THIS
  // bill, and what that discount costs in points — all computed server-side
  // (the 50% cap lives in the Server Action; this is only the preview of it,
  // and rewards.ts is server-only so the rates can't be imported here).
  pointsBalance: number;
  milesDiscountCents: number;
  milesPointsCost: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [applyMiles, setApplyMiles] = useState(false);
  const [state, formAction, pending] = useActionState<PayBillState, FormData>(payBill, null);

  const canUseMiles = milesDiscountCents > 0;
  const discountCents = applyMiles && canUseMiles ? milesDiscountCents : 0;
  const chargeCents = bill.amountCents - discountCents;

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
          {/* Due-soon (or overdue) and unpaid: warning icon + danger token.
              Otherwise unchanged neutral styling. */}
          <p
            className={
              "flex items-center gap-1 text-sm " +
              (dueSoon ? "font-medium text-danger-strong" : "text-ink-muted")
            }
          >
            {dueSoon ? <Icon name="warning" size={13} className="shrink-0" /> : null}
            <span className="truncate">
              Due {ordinal(bill.dueDayOfMonth)} · {bill.category}
              {bill.autopay ? " · Autopay on" : ""}
            </span>
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
          ) : null}
        </div>
      </div>

      {!paidThisMonth && !confirming ? (
        <Button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 w-full justify-center"
        >
          Pay now
        </Button>
      ) : null}

      {!paidThisMonth && confirming ? (
        <form action={formAction} className="mt-4 border-t border-line pt-4">
          <input type="hidden" name="billId" value={bill.id} />
          <p className="text-sm text-ink">
            Pay <span className="font-semibold">{formatMoney(chargeCents, currency)}</span>{" "}
            for {bill.name} from your NETS balance?
          </p>

          {/* Redemption path #1 — apply Miles as a checkout discount. */}
          <label
            className={
              "mt-3 flex items-start gap-3 rounded-button border border-line p-3 " +
              (canUseMiles ? "cursor-pointer" : "opacity-60")
            }
          >
            <input
              type="checkbox"
              name="applyMiles"
              checked={applyMiles && canUseMiles}
              disabled={!canUseMiles}
              onChange={(e) => setApplyMiles(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">Apply Miles</span>
              <span className="block text-xs text-ink-muted">
                {canUseMiles
                  ? `Use ${milesPointsCost.toLocaleString()} pts for ${formatMoney(
                      milesDiscountCents,
                      currency,
                    )} off · max 50% of a payment`
                  : `${pointsBalance.toLocaleString()} pts — not enough to discount this bill yet`}
              </span>
            </span>
          </label>

          {discountCents > 0 ? (
            <p className="mt-2 text-xs text-ink-muted">
              {formatMoney(bill.amountCents, currency)} − {formatMoney(discountCents, currency)}{" "}
              Miles ={" "}
              <span className="font-semibold text-ink">{formatMoney(chargeCents, currency)}</span>
            </p>
          ) : null}

          {state?.error ? <p className="mt-2 text-sm text-danger-strong">{state.error}</p> : null}
          <div className="mt-3 flex flex-col gap-2">
            <Button type="submit" disabled={pending} className="w-full justify-center">
              {pending ? "Paying…" : "Confirm payment"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="w-full justify-center"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
