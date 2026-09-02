import { requireUser } from "@/lib/auth";
import { getAccount } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/lib/format";

export default async function PaymentMethodsPage() {
  const user = await requireUser();
  const account = await getAccount(user.id);
  const currency = account?.currency ?? "SGD";

  return (
    <div>
      <PageHeader title="Payment Methods" subtitle="Cards linked to your NETS Quest wallet." />

      {/* Same card face as Home's balance hero (gradient, rounded-wallet,
          contactless mark, NETS wordmark) — this simulated app has exactly
          one payment method: the wallet itself. Deliberately NO masked
          "•••• 0312" line, same reasoning as Home: Account holds no real
          card/PAN data, and fabricating digits would fake a credential. */}
      <div className="flex h-[188px] flex-col justify-between rounded-wallet bg-gradient-to-b from-hero to-accent p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-nets-blue-100">
              NETS Prepaid
            </p>
            <p className="mt-4 text-sm text-nets-blue-100">Available balance</p>
            <p className="mt-1 text-2xl font-semibold">
              {formatMoney(account?.balanceCents ?? 0, currency)}
            </p>
          </div>
          <Icon name="contactless" size={26} className="text-nets-blue-100" />
        </div>

        <div className="flex items-end justify-between">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white">
            Default
          </span>
          <span className="text-lg font-bold tracking-wide text-white">NETS</span>
        </div>
      </div>

      {/* Non-functional per spec — no onClick, nothing to wire up yet. */}
      <button
        type="button"
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-button border border-dashed border-line px-4 py-3 text-sm font-medium text-ink-muted hover:bg-surface-muted"
      >
        <Icon name="plus" size={16} />
        Add card
      </button>
    </div>
  );
}
