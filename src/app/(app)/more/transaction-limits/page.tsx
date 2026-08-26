import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { Icon } from "@/components/Icon";
import { PlaceholderPage } from "../PlaceholderPage";

export default async function TransactionLimitsPage() {
  await requireUser();
  return (
    <PlaceholderPage title="Transaction Limits" description="Set spending limits on your card.">
      <Card padded={false}>
        <div className="divide-y divide-border-light px-stack-md opacity-60">
          <ListRow leading={<Icon name="sliders" size={18} />} title="Per-transaction limit" value="$500.00" />
          <ListRow leading={<Icon name="sliders" size={18} />} title="Daily limit" value="$2,000.00" />
          <ListRow leading={<Icon name="sliders" size={18} />} title="Monthly limit" value="$10,000.00" />
        </div>
      </Card>
    </PlaceholderPage>
  );
}
