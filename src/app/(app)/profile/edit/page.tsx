import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

// No-frills stub, deliberately not a real form: the only account field that
// exists is the Supabase sign-in email itself — there's no name/avatar field
// anywhere in the schema to edit, and adding fake fields that don't persist
// would be more misleading than just saying so.
export default async function EditProfilePage() {
  const user = await requireUser();

  return (
    <div>
      <PageHeader title="Edit profile" subtitle="Your account details." />
      <Card>
        <p className="text-sm text-ink-muted">Email</p>
        <p className="mt-1 text-base font-medium text-ink">{user.email}</p>
        <p className="mt-4 text-sm text-ink-muted">
          Profile editing isn&apos;t available in this demo — this simulated
          account has no editable fields beyond the email you signed up with.
        </p>
      </Card>
    </div>
  );
}
