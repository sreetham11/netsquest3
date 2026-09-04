import { requireUser } from "@/lib/auth";
import { getAccount } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { TopUpForm } from "./TopUpForm";

// Top-up's own dedicated destination — previously an embedded $-input-and-
// button that sat permanently on Home; now reached from Home's "Top up"
// action tile instead, matching the real NETS app's tile-not-embedded-form
// pattern. TopUpForm itself (amount -> confirm -> success) is unchanged,
// just relocated from home/TopUpForm.tsx to here — same component, same
// topUp Server Action, same balance logic.
export default async function TopUpPage() {
  const user = await requireUser();
  const account = await getAccount(user.id);
  const currency = account?.currency ?? "SGD";

  return (
    <div>
      <PageHeader title="Top up" subtitle="Add funds to your NETS Quest wallet." />
      <TopUpForm
        balanceCents={account?.balanceCents ?? 0}
        currency={currency}
        accountId={account?.id ?? user.id}
      />
    </div>
  );
}
