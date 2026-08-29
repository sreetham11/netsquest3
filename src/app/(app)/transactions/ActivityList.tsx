"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { formatDate, formatSignedMoney } from "@/lib/format";
import { txnLeadingIcon, amountTone, txnValue } from "@/lib/txn";
import { NETS_PAYMENT_TYPES, isNetsPaymentType } from "@/lib/netsPaymentTypes";

type Txn = {
  id: string;
  description: string;
  category: string;
  amountCents: number;
  type: string;
  country: string | null;
  createdAt: Date;
  refundedAt?: Date | null;
};

// Client-side only — no new Prisma query. Filters the SAME txns array the
// server already fetched (getAllTransactions, unchanged); this is
// presentation-layer state, not a data-fetching change.
const FILTERS = [
  { key: "all", label: "All", test: () => true },
  { key: "payments", label: "Payments", test: (t: Txn) => (NETS_PAYMENT_TYPES as readonly string[]).includes(t.type) },
  { key: "topups", label: "Top-ups", test: (t: Txn) => t.type === "TOPUP" },
  { key: "transport", label: "Transport", test: (t: Txn) => t.category === "Transport" },
  { key: "rewards", label: "Rewards", test: (t: Txn) => t.type === "REWARD" },
] as const;

export function ActivityList({
  txns,
  currency,
  renderRefundAction,
}: {
  txns: Txn[];
  currency: string;
  // Opt-in render prop rather than this file importing RefundButton (and
  // transitively actions.ts -> prisma.ts) directly — this component is
  // reused as-is by src/app/preview/activity (out of scope for this task,
  // explicitly not to be touched), which was specifically built to have NO
  // prisma/supabase dependency anywhere in its tree. Next.js's server-action
  // bundling would likely make a direct import harmless in practice, but
  // there's no reason to bet that isolation guarantee on "likely" when a
  // prop avoids the question entirely. The real /transactions page passes
  // this; the preview page doesn't, so nothing renders there.
  renderRefundAction?: (transactionId: string) => ReactNode;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const filtered = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
    return txns.filter(active.test);
  }, [txns, filter]);

  // Grouped by calendar day, matching activity/screen.png's date-header
  // sections — Map preserves insertion order, and txns already arrive
  // newest-first from the server query, so groups come out newest-first too.
  const groups = useMemo(() => {
    const map = new Map<string, Txn[]>();
    for (const t of filtered) {
      const key = formatDate(t.createdAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(t);
      else map.set(key, [t]);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="flex flex-col gap-stack-md">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={
              "shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-label-md font-semibold transition-colors " +
              (filter === f.key
                ? "bg-primary text-on-primary"
                : "border border-border-light bg-surface-grey text-on-surface-variant hover:bg-surface-container-high")
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Icon name="transactions" size={22} />}
          title="Nothing here"
          description="No transactions match this filter."
        />
      ) : (
        <div className="flex flex-col gap-stack-md">
          {groups.map(([date, rows]) => (
            <div key={date}>
              <h4 className="mb-3 pl-1 text-label-md font-semibold uppercase tracking-widest text-on-surface-variant">
                {date}
              </h4>
              <Card padded={false}>
                <div className="divide-y divide-border-light px-stack-md">
                  {rows.map((t) => {
                    // Refundable: a real NETS payment (not a top-up/transfer/
                    // etc — isNetsPaymentType already excludes those), a
                    // debit, and not already refunded.
                    const refundable = isNetsPaymentType(t.type) && t.amountCents < 0 && !t.refundedAt;
                    return (
                      <div key={t.id}>
                        <ListRow
                          leading={<Icon name={txnLeadingIcon(t.type, t.amountCents)} size={18} />}
                          leadingTone={t.amountCents > 0 ? "success" : "primary"}
                          title={t.description}
                          subtitle={`${t.category}${t.country ? ` · ${t.country}` : ""}`}
                          value={txnValue(t.type, t.amountCents, formatSignedMoney(t.amountCents, currency))}
                          valueTone={amountTone(t.type, t.amountCents)}
                        />
                        {refundable && renderRefundAction ? (
                          <div className="flex justify-end pb-2">{renderRefundAction(t.id)}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
