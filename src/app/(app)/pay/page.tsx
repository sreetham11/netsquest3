import { requireUser } from "@/lib/auth";
import { getAccount } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { PayForm } from "./PayForm";

// Scan & Pay's real destination — reached after the NFC/Face ID intro
// animation in AppShell finishes (SCAN_ACTION.href in src/lib/nav.ts points
// here, not at /split). A genuine payment: makePayment debits the wallet,
// earns points via the same tier-multiplier system payBill uses, and can
// trigger auto-topup. Split is a fully separate flow reached only through
// its own More entry — nothing here touches Split's code or data.
export default async function PayPage() {
  const user = await requireUser();
  const account = await getAccount(user.id);
  const currency = account?.currency ?? "SGD";

  return (
    <div>
      <PageHeader title="Scan & Pay" subtitle="Pay a merchant from your NETS Quest wallet." />
      <PayForm balanceCents={account?.balanceCents ?? 0} currency={currency} />
    </div>
  );
}
