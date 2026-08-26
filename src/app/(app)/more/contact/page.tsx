import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { PlaceholderPage } from "../PlaceholderPage";

export default async function ContactUsPage() {
  await requireUser();
  return (
    <PlaceholderPage title="Contact Us" description="Get in touch with NETS support.">
      <EmptyState
        icon={<Icon name="help-circle" size={22} />}
        title="Nothing here yet"
        description="Contact details will live here."
      />
    </PlaceholderPage>
  );
}
