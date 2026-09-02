import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { SecurityToggles } from "./SecurityToggles";

export default async function SecurityPage() {
  await requireUser();

  return (
    <div>
      <PageHeader
        title="Security"
        subtitle="Preferences for this device — not wired to any real check yet."
      />
      <Card padded={false}>
        <SecurityToggles />
      </Card>
    </div>
  );
}
