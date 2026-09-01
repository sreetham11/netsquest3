import { requireUser } from "@/lib/auth";
import { getAccount, getAllTransactions, getRecentSplitPartners } from "@/lib/data/queries";
import { isNetsPaymentType } from "@/lib/netsPaymentTypes";
import { PageHeader } from "@/components/ui/PageHeader";
import { SmartSplitFlow } from "../SmartSplitFlow";

// Smart Split — the second, guided entry point into Split (alongside
// per-transaction "Split this" on Activity rows, which stays untouched).
// Select transaction(s) -> name -> choose people, then hands off into the
// same NewSplitForm/createSplit path "Split this" already uses.
export default async function SmartSplitPage() {
  const user = await requireUser();
  const [account, txns, recentPartners] = await Promise.all([
    getAccount(user.id),
    getAllTransactions(user.id),
    getRecentSplitPartners(user.id),
  ]);
  const currency = account?.currency ?? "SGD";

  // Same splittable criterion as "Split this" (transactions/page.tsx's
  // splitActionsById) — a real NETS payment debit, the only kind of
  // transaction it makes sense to divide with friends.
  const splittable = txns.filter((t) => isNetsPaymentType(t.type) && t.amountCents < 0);

  return (
    <div>
      <PageHeader title="Smart Split" subtitle="Pick what to split, then who's splitting it." />
      <SmartSplitFlow txns={splittable} currency={currency} recentPartners={recentPartners} />
    </div>
  );
}
