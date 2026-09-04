import { requireUser } from "@/lib/auth";
import { getSplits, getOwedToUser, getContacts } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/lib/format";
import { SCAN_ACTION } from "@/lib/nav";
import { NewSplitForm } from "./NewSplitForm";
import { SplitCard } from "./SplitCard";

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
      {/* Split has no per-split detail route (every split renders inline
          right here), and Scan & Pay is a separate merchant-payment flow
          that isn't tied to any one split — so this lives at the page
          level, not nested inside a split card. Reuses SCAN_ACTION's own
          href/icon/label (src/lib/nav.ts) rather than a second hardcoded
          "/pay" reference, so it's the exact same entry point as the bottom
          nav's center action — no new payment logic here. The `?from=split`
          marker is the ONE thread connecting the two flows: PayForm reads it
          to decide whether a completed payment's success screen offers
          "Split this?" (see pay/page.tsx, pay/PayForm.tsx). The bottom nav's
          own Scan & Pay entry (AppShell) carries no such marker, so that
          path stays exactly as before. */}
      <PageHeader
        title="Split"
        subtitle="Instant bill splitting — no invites, no waiting."
        action={
          <ButtonLink href={`${SCAN_ACTION.href}?from=split`} variant="secondary" className="gap-1.5">
            <Icon name={SCAN_ACTION.icon} size={16} />
            {SCAN_ACTION.label}
          </ButtonLink>
        }
      />

      {owed.owedCents > 0 ? (
        <div className="mt-4">
          <StatCard
            label="You're owed"
            value={formatMoney(owed.owedCents)}
            hint={`Across ${owed.splitCount} split${owed.splitCount === 1 ? "" : "s"}`}
            tone="positive"
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
          {splits.map((split) => (
            <SplitCard key={split.id} split={split} />
          ))}
        </div>
      )}
    </div>
  );
}
