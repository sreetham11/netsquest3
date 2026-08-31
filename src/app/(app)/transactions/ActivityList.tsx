"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { formatDate, formatSignedMoney } from "@/lib/format";
import { txnLeadingIcon, amountTone, txnValue } from "@/lib/txn";
import { NETS_PAYMENT_TYPES } from "@/lib/netsPaymentTypes";

type Txn = {
  id: string;
  description: string;
  category: string;
  amountCents: number;
  type: string;
  country: string | null;
  createdAt: Date;
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
  refundActionsById,
  splitActionsById,
}: {
  txns: Txn[];
  currency: string;
  // Pre-rendered elements keyed by transaction id, NOT a callback — a plain
  // function can't cross the Server->Client Component boundary (React Flight
  // only serializes Server Actions and data/JSX, not arbitrary closures;
  // passing one crashes with "Functions cannot be passed directly to Client
  // Components" the moment this page is actually rendered with real data,
  // which is exactly what happened in production). Pre-rendering the
  // <RefundButton> elements server-side and passing the finished JSX avoids
  // that entirely, while still keeping this file free of any RefundButton/
  // actions.ts/prisma import — it never needs to know how a refund action is
  // built, just where to place one if the caller supplied it. The real
  // /transactions page passes this; src/app/preview/activity (out of scope,
  // explicitly not to be touched) doesn't, so nothing renders there.
  refundActionsById?: Record<string, ReactNode>;
  // Same render-prop reasoning as refundActionsById — these are plain <Link>
  // elements though, so nothing here needs prisma/actions.ts at all either.
  splitActionsById?: Record<string, ReactNode>;
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
                    const refundAction = refundActionsById?.[t.id];
                    const splitAction = splitActionsById?.[t.id];
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
                        {splitAction || refundAction ? (
                          <div className="flex justify-end gap-2 pb-2">
                            {splitAction}
                            {refundAction}
                          </div>
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
