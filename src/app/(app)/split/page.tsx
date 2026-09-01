import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSplits } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/Icon";
import { formatMoney, formatDayMonth } from "@/lib/format";
import { transactionCategoryToIconCategory } from "@/lib/categoryIcon";
import { NETS_PAYMENT_TYPES } from "@/lib/netsPaymentTypes";
import { toggleSplitParticipantPaid } from "../actions";
import { NewSplitForm } from "./NewSplitForm";

const CATEGORY_ICON: Record<string, IconName> = {
  General: "split",
  food: "fast-food",
  cafe: "coffee",
  ride: "ride",
  grocery: "grocery",
};

// Split's own category dropdown — narrower than the full icon-category
// vocabulary transactionCategoryToIconCategory maps into (e.g. it maps
// "Entertainment" -> "cinema", which isn't one of these 5), so a mapped
// result still has to be checked against this set before being trusted as
// this form's initial category.
const SPLIT_CATEGORY_VALUES = new Set(["General", "food", "cafe", "ride", "grocery"]);

// Split (formerly Vault) is allowed more visual energy than the rest of the
// app — bolder type, avatars, a confident blue accent. Still strictly locked
// tokens, no new hues/fonts/sizes. Overseas was named as a maybe-candidate
// for the same treatment but has NOT been touched — confirm before extending.
export default async function SplitPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await requireUser();
  const { from } = await searchParams;

  // "Split this" entry point (Activity rows, payment-success screen) —
  // looked up server-side rather than trusting raw query-string amount/title
  // values, so the prefill always matches a real, owned transaction. Scoped
  // to userId (no cross-account leak via a guessed/replayed id) and to real
  // qualifying NETS payments only (a top-up/income/refund isn't something
  // you'd split with friends).
  const [splits, sourceTransaction] = await Promise.all([
    getSplits(user.id),
    from
      ? prisma.transaction.findFirst({
          where: { id: from, userId: user.id, type: { in: [...NETS_PAYMENT_TYPES] }, amountCents: { lt: 0 } },
        })
      : Promise.resolve(null),
  ]);

  const mappedCategory = sourceTransaction
    ? transactionCategoryToIconCategory(sourceTransaction.category)
    : null;

  return (
    <div>
      <PageHeader title="Split" subtitle="Instant bill splitting — no invites, no waiting." />

      <p className="text-body-lg font-medium text-on-surface">
        You covered dinner. Split makes sure it doesn&apos;t stay that way.
      </p>

      <div className="mt-6">
        <NewSplitForm
          initialTitle={sourceTransaction?.description}
          initialTotalAmount={
            sourceTransaction ? (Math.abs(sourceTransaction.amountCents) / 100).toFixed(2) : undefined
          }
          initialCategory={
            sourceTransaction
              ? mappedCategory && SPLIT_CATEGORY_VALUES.has(mappedCategory)
                ? mappedCategory
                : "General"
              : undefined
          }
        />
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
                <div className="h-1.5 bg-primary" />
                <div className="p-8">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
                      <Icon name={CATEGORY_ICON[split.category] ?? "split"} size={22} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-headline-md text-on-surface">
                        {split.title}
                      </h2>
                      <p className="mt-0.5 text-body-md text-on-surface-variant">
                        {formatDayMonth(split.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="text-currency-display text-on-surface">{formatMoney(split.totalAmountCents)}</p>
                    <div className="flex -space-x-2">
                      {split.participants.map((p, i) => (
                        <Avatar key={p.id} name={p.name} index={i} size={32} className="ring-2 ring-surface" />
                      ))}
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-body-md font-medium text-primary">
                        {paidCount} of {total} paid
                      </span>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={paidProgress} size="lg" />
                    </div>
                  </div>

                  <div className="mt-6 divide-y divide-border-light border-t border-border-light">
                    {split.participants.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3 py-3">
                        <Avatar name={p.name} index={i} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-body-md font-medium text-on-surface">
                            {p.name}
                            {p.userId ? (
                              <Icon
                                name="check-circle"
                                size={12}
                                className="shrink-0 text-primary"
                                aria-hidden={false}
                                aria-label="Registered user"
                              />
                            ) : null}
                          </p>
                          <p className="text-body-md text-on-surface-variant">{formatMoney(p.shareAmountCents)}</p>
                        </div>
                        <form action={toggleSplitParticipantPaid}>
                          <input type="hidden" name="participantId" value={p.id} />
                          <button
                            type="submit"
                            className={
                              p.paid
                                ? "inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-label-md font-medium text-on-primary hover:opacity-90"
                                : "inline-flex items-center gap-1 rounded-full border border-border-light px-3 py-1.5 text-label-md font-medium text-on-surface-variant hover:bg-surface-container-low"
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
