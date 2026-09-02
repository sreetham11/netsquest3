import { requireUser } from "@/lib/auth";
import { getAccount } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutoTopupForm } from "./AutoTopupForm";

// Settings only — the real trigger logic lives in
// src/lib/autoTopup.ts::triggerAutoTopupIfNeeded, called from inside the
// same atomic transaction as every balance-decreasing write (payBill,
// makePayment), not from this page.
export default async function AutoTopupPage() {
  const user = await requireUser();
  const account = await getAccount(user.id);

  return (
    <div>
      <PageHeader
        title="Auto Top-up"
        subtitle="Keep your balance from running dry automatically."
      />
      <AutoTopupForm
        initialEnabled={account?.autoTopupEnabled ?? false}
        initialThresholdCents={account?.autoTopupThresholdCents ?? null}
        initialAmountCents={account?.autoTopupAmountCents ?? null}
      />
    </div>
  );
}
