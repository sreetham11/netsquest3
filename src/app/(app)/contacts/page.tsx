import { requireUser } from "@/lib/auth";
import { getContacts } from "@/lib/data/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/Icon";
import { deleteContact } from "../actions";
import { AddContactForm } from "./AddContactForm";

// Saved payees you manage yourself. Nothing here contacts anyone: the phone
// number is stored and shown PayNow-style so a payee looks familiar, and is
// never used for messaging, invites, notifications, or user lookup.
export default async function ContactsPage() {
  const user = await requireUser();
  const contacts = await getContacts(user.id);

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle="Saved payees for faster splitting — names you manage, not real accounts."
      />

      <AddContactForm />

      <div className="mt-6">
        {contacts.length === 0 ? (
          <EmptyState
            icon={<Icon name="contacts" size={22} />}
            title="No saved contacts"
            description="Add someone you split with often and they'll show up as a tap-to-add chip in Split."
          />
        ) : (
          <Card padded={false}>
            <div className="divide-y divide-line px-6">
              {contacts.map((contact) => (
                <ListRow
                  key={contact.id}
                  leading={<Icon name="contacts" size={18} />}
                  title={contact.name}
                  subtitle={contact.phoneNumber ?? "No number saved"}
                  actions={
                    <form action={deleteContact}>
                      <input type="hidden" name="contactId" value={contact.id} />
                      <button
                        type="submit"
                        aria-label={`Delete ${contact.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-danger-strong"
                      >
                        <Icon name="plus" size={14} className="rotate-45" />
                      </button>
                    </form>
                  }
                />
              ))}
            </div>
          </Card>
        )}
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        Numbers are for your reference only — NETS Quest never messages or
        notifies your contacts.
      </p>
    </div>
  );
}
