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
    <form action={formAction} className="mt-1">
      <input type="hidden" name="transactionId" value={transactionId} />
      <button
        type="submit"
        disabled={pending}
        className="text-label-md font-medium text-primary hover:underline disabled:opacity-60"
      >
        {pending ? "Refunding…" : "Refund"}
      </button>
      {state?.error ? <p className="mt-0.5 text-label-md text-error">{state.error}</p> : null}
    </form>
  );
}
