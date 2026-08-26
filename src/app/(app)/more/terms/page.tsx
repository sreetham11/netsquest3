import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { PlaceholderPage } from "../PlaceholderPage";

export default async function TermsOfServicePage() {
  await requireUser();
  return (
    <PlaceholderPage title="Terms of Service" description="The terms governing your use of NETS Quest.">
      <EmptyState
        icon={<Icon name="help-circle" size={22} />}
        title="Nothing here yet"
        description="Terms of Service content will live here."
      />
    </PlaceholderPage>
  );
}
