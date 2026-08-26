import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { Icon } from "@/components/Icon";
import { PlaceholderPage } from "../PlaceholderPage";

export default async function CardSettingsPage() {
  await requireUser();
  return (
    <PlaceholderPage title="Card Settings" description="Manage your NETS Prepaid card.">
      <Card padded={false}>
        <div className="divide-y divide-border-light px-stack-md opacity-60">
          <ListRow leading={<Icon name="edit-profile" size={18} />} title="Card Nickname" value="NETS Prepaid" />
          <ListRow leading={<Icon name="card" size={18} />} title="Freeze Card" value="Off" />
          <ListRow leading={<Icon name="shield" size={18} />} title="View PIN" value={<Icon name="chevron-right" size={16} />} />
        </div>
      </Card>
    </PlaceholderPage>
  );
}
