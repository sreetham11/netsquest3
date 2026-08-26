"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { redeemReward, type RedeemRewardState } from "../actions";

// One useActionState per reward card (same pattern as BillCard), so a failure
// renders on the card that was clicked instead of somewhere generic.
//
// `pending` disables the button mid-flight — that only stops the obvious
// double-click; the real double-redeem guard is the conditional decrement in
// redeemReward, since a client can't be trusted with that.
export function RedeemButton({
  rewardId,
  affordable,
}: {
  rewardId: string;
  affordable: boolean;
}) {
  const [state, formAction, pending] = useActionState<RedeemRewardState, FormData>(
    redeemReward,
    null,
  );

  return (
    <form action={formAction} className="w-full">
      <input type="hidden" name="rewardId" value={rewardId} />
      <Button type="submit" disabled={!affordable || pending} className="w-full">
        {pending ? "Redeeming…" : "Redeem"}
      </Button>
      {state?.error ? (
        <p className="mt-2 text-label-md text-error">{state.error}</p>
      ) : null}
    </form>
  );
}
