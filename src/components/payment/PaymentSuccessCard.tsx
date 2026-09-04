"use client";

import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { formatMoney, formatDate, formatTime } from "@/lib/format";

// The ONE payment-success card in this app — see PaymentConfirmCard for why
// this is shared rather than duplicated per flow.
export function PaymentSuccessCard({
  merchant,
  amountCents,
  currency = "SGD",
  successAt,
  txnRef,
  pointsEarned,
  onAgain,
  againLabel = "Pay again",
  doneHref = "/home",
  doneLabel = "Done",
  splitPromptHref,
}: {
  merchant: string;
  amountCents: number;
  currency?: string;
  successAt: Date;
  txnRef: string;
  pointsEarned: number;
  onAgain: () => void;
  againLabel?: string;
  doneHref?: string;
  doneLabel?: string;
  // Set only when this payment was reached from within Split (see
  // pay/PayForm.tsx) — offers a one-tap way back into New Split, pre-filled
  // with this payment's real merchant/amount/category. Omitted everywhere
  // else (AiDealFinder's checkout, a payment opened from the bottom nav).
  splitPromptHref?: string;
}) {
  return (
    <Card className="flex flex-col items-center gap-4 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-white">
        <Icon name="check" size={22} />
      </span>
      <div>
        <p className="text-lg font-bold text-ink">Payment Success</p>
        <p className="mt-1 text-sm text-ink-muted">{merchant}</p>
      </div>

      <div className="flex w-full flex-col gap-2 rounded-button bg-surface-muted px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">Amount</span>
          <span className="font-semibold text-ink">{formatMoney(amountCents, currency)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">Date</span>
          <span className="text-ink">
            {formatDate(successAt)} · {formatTime(successAt)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">Transaction No</span>
          <span className="text-ink">{txnRef}</span>
        </div>
      </div>

      {pointsEarned > 0 ? (
        <p className="text-xs text-ink-muted">+{pointsEarned.toLocaleString()} Miles earned</p>
      ) : null}

      <div className="flex w-full gap-2">
        <Button type="button" variant="secondary" onClick={onAgain} className="flex-1 justify-center">
          {againLabel}
        </Button>
        <ButtonLink href={doneHref} className="flex-1 justify-center">
          {doneLabel}
        </ButtonLink>
      </div>

      {splitPromptHref ? (
        <ButtonLink href={splitPromptHref} variant="secondary" className="w-full justify-center gap-1.5">
          <Icon name="split" size={16} />
          Split this?
        </ButtonLink>
      ) : null}
    </Card>
  );
}
