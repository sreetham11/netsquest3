"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "@/components/Icon";
import { formatMoney, formatDayMonth } from "@/lib/format";
import { toggleSplitParticipantPaid } from "../actions";
import { SpinToDecide } from "./SpinToDecide";
import { WhatsAppReminderButton } from "./WhatsAppReminderButton";

const CATEGORY_ICON: Record<string, IconName> = {
  General: "split",
  food: "fast-food",
  cafe: "coffee",
  ride: "ride",
  grocery: "grocery",
};

type SplitParticipant = {
  id: string;
  name: string;
  shareAmountCents: number;
  paid: boolean;
  contact: { phoneNumber: string | null } | null;
};

type SplitData = {
  id: string;
  title: string;
  category: string;
  totalAmountCents: number;
  createdAt: Date;
  payerParticipantId: string | null;
  spunAt: Date | null;
  participants: SplitParticipant[];
};

// Collapsible show/hide wrapper only — none of the data or logic below
// changes based on `expanded`; the same participant rows, "Mark paid"
// forms, WhatsApp reminders, and SpinToDecide render exactly as before,
// just not mounted until the card is opened. Starts collapsed so a list of
// several splits reads as a scannable summary list rather than everyone's
// full paid/unpaid breakdown stacked one after another.
export function SplitCard({ split }: { split: SplitData }) {
  const [expanded, setExpanded] = useState(false);

  const paidCount = split.participants.filter((p) => p.paid).length;
  const total = split.participants.length;
  const paidProgress = total > 0 ? paidCount / total : 0;
  const payer = split.participants.find((p) => p.id === split.payerParticipantId) ?? null;

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="h-1.5 bg-accent" />
      <div className="p-8">
        {/* Collapsed summary — name, date, total, avatars, paid pill. The
            whole thing is the toggle target (plus the chevron as an
            explicit affordance); nothing interactive lives inside it, so a
            plain <button> wrapper is valid here. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="w-full text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-white">
              <Icon name={CATEGORY_ICON[split.category] ?? "split"} size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-2xl font-bold tracking-tight text-ink">{split.title}</h2>
              <p className="mt-0.5 text-sm text-ink-muted">{formatDayMonth(split.createdAt)}</p>
            </div>
            <Icon
              name="chevron"
              size={20}
              className={
                "shrink-0 text-ink-muted transition-transform duration-200 " +
                (expanded ? "rotate-180" : "")
              }
            />
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-2xl font-bold text-ink">{formatMoney(split.totalAmountCents)}</p>
            <div className="flex -space-x-2">
              {split.participants.map((p, i) => (
                <Avatar key={p.id} name={p.name} index={i} size={32} className="ring-2 ring-surface" />
              ))}
            </div>
          </div>

          <div className="mt-5">
            {/* Solid accent fill, not the pale bg-nets-blue-100 tint — this
                is the "did everyone pay" signal for the whole card, so it
                earns real color instead of reading as just another muted
                label. Swaps to the check icon once fully settled, for a
                distinct payoff moment. */}
            <span
              className={
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium " +
                (paidCount === total ? "bg-accent-strong text-white" : "bg-accent text-white")
              }
            >
              {paidCount === total ? <Icon name="check" size={13} /> : null}
              {paidCount === total ? "All settled" : `${paidCount} of ${total} paid`}
            </span>
          </div>
        </button>

        {expanded ? (
          <>
            <div className="mt-3">
              <ProgressBar value={paidProgress} tone="accent" size="lg" />
            </div>

            {payer ? (
              <p className="mt-4 rounded-button bg-surface-muted px-3 py-2 text-sm text-ink">
                <span className="font-semibold">{payer.name}</span> fronted this bill — everyone else
                owes {payer.name} their share.
              </p>
            ) : null}

            {/* Row layout: avatar far left, name (+ status) in the middle,
                amount BOLD and right-aligned right next to the paid toggle
                — the amount and paid-state are the two things a glance
                needs, so they sit together. */}
            <div className="mt-6 divide-y divide-line border-t border-line">
              {split.participants.map((p, i) => {
                // Only makes sense once a payer is resolved (Spin to Decide
                // has run — otherwise there's no "you owe X" to remind
                // anyone of, same gate the "Owes" text above already uses),
                // never for the payer's own row, never once already paid,
                // and only when there's an actual saved phone number to
                // send to — not just a linked contact with none set.
                const canRemind =
                  payer !== null && payer.id !== p.id && !p.paid && Boolean(p.contact?.phoneNumber);

                return (
                  <div key={p.id} className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} index={i} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                        {payer ? (
                          <p className="truncate text-xs text-ink-muted">
                            {payer.id === p.id ? "Fronted the bill" : `Owes ${payer.name}`}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-base font-bold text-ink">
                          {formatMoney(p.shareAmountCents)}
                        </span>
                        <form action={toggleSplitParticipantPaid}>
                          <input type="hidden" name="participantId" value={p.id} />
                          <button
                            type="submit"
                            className={
                              p.paid
                                ? "inline-flex items-center gap-1 rounded-full bg-accent-strong px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                                : "inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-muted"
                            }
                          >
                            {p.paid ? (
                              <>
                                <Icon name="check" size={13} />
                                Paid
                              </>
                            ) : (
                              "Mark paid"
                            )}
                          </button>
                        </form>
                      </div>
                    </div>

                    {canRemind ? (
                      <div className="mt-2 pl-11">
                        <WhatsAppReminderButton participantId={p.id} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <SpinToDecide
              splitId={split.id}
              split={{
                payerParticipantId: split.payerParticipantId,
                spunAt: split.spunAt,
              }}
              participants={split.participants.map((p) => ({
                id: p.id,
                name: p.name,
                shareAmountCents: p.shareAmountCents,
              }))}
            />
          </>
        ) : null}
      </div>
    </Card>
  );
}
