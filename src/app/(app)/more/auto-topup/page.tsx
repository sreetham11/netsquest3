import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAccount } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon } from "@/components/Icon";
import { AutoTopupForm } from "./AutoTopupForm";

// Real now — was one of PlaceholderPage's 7 no-design-yet sub-pages; this one
// has real state (Account.autoTopup*) and a real trigger (recordNetsPayment
// -> triggerAutoTopupIfNeeded), so it gets its own header markup instead of
// PlaceholderPage's "doesn't have its own design yet" banner.
export default async function AutoTopUpPage() {
  const user = await requireUser();
  const account = await getAccount(user.id);

  return (
    <div>
      <Link
        href="/more"
        className="mb-4 inline-flex items-center gap-1 text-body-md font-medium text-primary hover:underline"
      >
        <Icon name="chevron-left" size={16} />
        More
      </Link>
      <PageHeader title="Auto Top-up" subtitle="Automatically top up your balance when it runs low." />
      <AutoTopupForm
        initialEnabled={account?.autoTopupEnabled ?? false}
        initialThresholdCents={account?.autoTopupThresholdCents ?? null}
        initialAmountCents={account?.autoTopupAmountCents ?? null}
      />
    </div>
  );
}
