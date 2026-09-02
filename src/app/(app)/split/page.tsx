import { requireUser } from "@/lib/auth";
import { getSplits, getOwedToUser, getContacts } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/Icon";
import { formatMoney, formatDayMonth } from "@/lib/format";
import { toggleSplitParticipantPaid } from "../actions";
import { NewSplitForm } from "./NewSplitForm";
import { SpinToDecide } from "./SpinToDecide";

const CATEGORY_ICON: Record<string, IconName> = {
  General: "split",
  food: "fast-food",
  cafe: "coffee",
  ride: "ride",
  grocery: "grocery",
};

// Split (formerly Vault) is allowed more visual energy than the rest of the
// app — bolder type, avatars, a confident blue accent. Still strictly locked
// tokens, no new hues/fonts/sizes. Overseas was named as a maybe-candidate
// for the same treatment but has NOT been touched — confirm before extending.
export default async function SplitPage() {
  const user = await requireUser();
  const [splits, owed, contacts] = await Promise.all([
    getSplits(user.id),
    getOwedToUser(user.id),
    getContacts(user.id),
  ]);

  return (
    <div>
      <PageHeader title="Split" subtitle="Instant bill splitting — no invites, no waiting." />

      {owed.owedCents > 0 ? (
        <div className="mt-4">
          <StatCard
            label="You're owed"
            value={formatMoney(owed.owedCents)}
            hint={`Across ${owed.splitCount} split${owed.splitCount === 1 ? "" : "s"}`}
          />
        </div>
      ) : null}

      <div className="mt-6">
        <NewSplitForm contacts={contacts} />
      </div>

      {splits.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Icon name="split" size={22} />}
            title="No splits yet."
            description="Someone's about to owe you money. Start a split to keep track."
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {splits.map((split) => {
            const paidCount = split.participants.filter((p) => p.paid).length;
            const total = split.participants.length;
            const paidProgress = total > 0 ? paidCount / total : 0;
            const payer =
              split.participants.find((p) => p.id === split.payerParticipantId) ?? null;

            return (
              <Card key={split.id} padded={false} className="overflow-hidden">
                <div className="h-1.5 bg-accent" />
                <div className="p-8">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                      <Icon name={CATEGORY_ICON[split.category] ?? "split"} size={22} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-2xl font-bold tracking-tight text-ink">
                        {split.title}
                      </h2>
                      <p className="mt-0.5 text-sm text-ink-muted">
                        {formatDayMonth(split.createdAt)}
                      </p>
                    </div>
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
                    <div className="flex items-center justify-between">
                      {/* Solid accent fill, not the pale bg-nets-blue-100 tint —
                          this is the "did everyone pay" signal for the whole
                          card, so it earns real color instead of reading as
                          just another muted label. Swaps to the check icon
                          once fully settled, for a distinct payoff moment. */}
                      <span
                        className={
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium " +
                          (paidCount === total
                            ? "bg-accent-strong text-white"
                            : "bg-accent text-white")
                        }
                      >
                        {paidCount === total ? <Icon name="check" size={13} /> : null}
                        {paidCount === total ? "All settled" : `${paidCount} of ${total} paid`}
                      </span>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={paidProgress} tone="accent" size="lg" />
                    </div>
                  </div>

                  {payer ? (
                    <p className="mt-4 rounded-button bg-surface-muted px-3 py-2 text-sm text-ink">
                      <span className="font-semibold">{payer.name}</span> fronted this
                      bill — everyone else owes {payer.name} their share.
                    </p>
                  ) : null}

                  {/* Row layout: avatar far left, name (+ status) in the
                      middle, amount BOLD and right-aligned right next to the
                      paid toggle — the amount and paid-state are the two
                      things a glance needs, so they sit together. */}
                  <div className="mt-6 divide-y divide-line border-t border-line">
                    {split.participants.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3 py-3">
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
                    ))}
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
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
