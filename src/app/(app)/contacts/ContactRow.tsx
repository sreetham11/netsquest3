"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ListRow } from "@/components/ui/ListRow";
import { Icon } from "@/components/Icon";
import { deleteContact } from "../actions";

// One contact row with a tap-to-confirm delete — the bare "X" used to remove
// the contact immediately on click with no way back. Confirming inline below
// the row (ListRow's `caption` slot) matches this app's existing
// confirm-before-destructive-action pattern (see BillCard's "Pay now" ->
// confirm step) rather than introducing a first modal/dialog component.
export function ContactRow({ contact }: { contact: { id: string; name: string; phoneNumber: string | null } }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    const formData = new FormData();
    formData.append("contactId", contact.id);
    startTransition(async () => {
      await deleteContact(formData);
      // No need to reset `confirming` on success — revalidatePath inside
      // deleteContact unmounts this row entirely once the list re-renders.
    });
  }

  return (
    <ListRow
      leading={<Icon name="contacts" size={18} />}
      title={contact.name}
      subtitle={contact.phoneNumber ?? "No number saved"}
      actions={
        confirming ? null : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${contact.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-danger-strong"
          >
            <Icon name="plus" size={14} className="rotate-45" />
          </button>
        )
      }
      reserveActionsSpace
      caption={
        confirming ? (
          <div className="flex items-center justify-between gap-3 rounded-button bg-surface-muted px-3 py-2.5">
            <span className="text-sm text-ink">Delete {contact.name}?</span>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                onClick={confirmDelete}
                loading={pending}
                className="px-3 py-1.5 text-xs"
              >
                {pending ? "Deleting…" : "Confirm"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="px-3 py-1.5 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null
      }
    />
  );
}
