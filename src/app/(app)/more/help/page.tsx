import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { PlaceholderPage } from "../PlaceholderPage";

export default async function HelpCentrePage() {
  await requireUser();
  return (
    <PlaceholderPage title="Help Centre" description="Find answers to common questions.">
      <EmptyState
        icon={<Icon name="help-circle" size={22} />}
        title="Nothing here yet"
        description="The Help Centre content will live here."
      />
    </PlaceholderPage>
  );
}
