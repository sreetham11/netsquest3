import { requireUser } from "@/lib/auth";
import { getAccount } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { PayForm } from "./PayForm";

// Scan & Pay's real destination — reached after the NFC/Face ID intro
// animation in AppShell finishes (SCAN_ACTION.href in src/lib/nav.ts points
// here, not at /split), or directly from Split's own "Scan & Pay" button.
// A genuine payment: makePayment debits the wallet, earns points via the
// same tier-multiplier system payBill uses, and can trigger auto-topup.
// Split and Scan & Pay stay separate flows with no shared code beyond this:
// the `from=split` query param (set only by Split's button, never by the
// bottom nav's) tells PayForm whether to offer "Split this?" once the
// payment succeeds.
export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await requireUser();
  const account = await getAccount(user.id);
  const currency = account?.currency ?? "SGD";
  const { from } = await searchParams;

  return (
    <div>
      <PageHeader title="Scan & Pay" subtitle="Scan a merchant's QR code to pay from your NETS Quest wallet." />
      <PayForm balanceCents={account?.balanceCents ?? 0} currency={currency} fromSplit={from === "split"} />
    </div>
  );
}
