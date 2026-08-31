"use client";

// One useActionState per row (same pattern as RedeemButton/BillCard), so a
// failure renders on the row that was clicked instead of somewhere generic.
import { useActionState } from "react";
import { refundTransaction, type RefundTransactionState } from "../actions";

export function RefundButton({ transactionId }: { transactionId: string }) {
  const [state, formAction, pending] = useActionState<RefundTransactionState, FormData>(
    refundTransaction,
    null,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="transactionId" value={transactionId} />
      {/* Small secondary-action button — same color/weight language as
          ActivityList's own filter chips (bg-surface-grey, border-light,
          on-surface-variant text, hover:surface-container-high), just
          rounded-md instead of rounded-full: a modest rect, not a pill. */}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center rounded-md border border-border-light bg-surface-grey px-3 py-1.5 text-label-md font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-60"
      >
        {pending ? "Refunding…" : "Refund"}
      </button>
      {state?.error ? <p className="mt-1 text-label-md text-error">{state.error}</p> : null}
    </form>
  );
}
