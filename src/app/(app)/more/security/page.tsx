import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { Icon } from "@/components/Icon";
import { PlaceholderPage } from "../PlaceholderPage";

export default async function SecurityPage() {
  await requireUser();
  return (
    <PlaceholderPage title="Security & Privacy" description="Keep your account secure.">
      <Card padded={false}>
        <div className="divide-y divide-border-light px-stack-md opacity-60">
          <ListRow leading={<Icon name="shield" size={18} />} title="Change Password" value={<Icon name="chevron-right" size={16} />} />
          <ListRow leading={<Icon name="shield" size={18} />} title="Two-Factor Authentication" value="Off" />
          <ListRow leading={<Icon name="shield" size={18} />} title="Login Activity" value={<Icon name="chevron-right" size={16} />} />
        </div>
      </Card>
    </PlaceholderPage>
  );
}
