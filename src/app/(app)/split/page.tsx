import { requireUser } from "@/lib/auth";
import { getSplits } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/Icon";
import { formatMoney, formatDayMonth } from "@/lib/format";
import { toggleSplitParticipantPaid } from "../actions";
import { NewSplitForm } from "./NewSplitForm";

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
  const splits = await getSplits(user.id);

  return (
    <div>
      <PageHeader title="Split" subtitle="Instant bill splitting — no invites, no waiting." />

      <p className="text-base font-medium text-ink">
        You covered dinner. Split makes sure it doesn&apos;t stay that way.
      </p>

      <div className="mt-6">
        <NewSplitForm />
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
                      <span className="rounded-full bg-nets-blue-100 px-3 py-1 text-sm font-medium text-accent">
                        {paidCount} of {total} paid
                      </span>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={paidProgress} size="lg" />
                    </div>
                  </div>

                  <div className="mt-6 divide-y divide-line border-t border-line">
                    {split.participants.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3 py-3">
                        <Avatar name={p.name} index={i} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                            {p.name}
                            {p.userId ? (
                              <Icon
                                name="check-circle"
                                size={12}
                                className="shrink-0 text-accent"
                                aria-hidden={false}
                                aria-label="Registered user"
                              />
                            ) : null}
                          </p>
                          <p className="text-sm text-ink-muted">{formatMoney(p.shareAmountCents)}</p>
                        </div>
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
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
