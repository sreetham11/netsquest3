"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { createContact } from "../actions";

// Name is required; the number is optional and cosmetic (see createContact).
//
// Uses useTransition + a direct action call rather than useActionState so the
// fields can be cleared and the card collapsed right where the result is
// known — no post-submit effect (same pattern as Home's TopUpForm).
export function AddContactForm() {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function close() {
    setExpanded(false);
    setName("");
    setPhoneNumber("");
    setError("");
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError("");

    startTransition(async () => {
      const formData = new FormData();
      formData.append("name", trimmed);
      formData.append("phoneNumber", phoneNumber.trim());
      const result = await createContact(null, formData);
      // Duplicate names are rejected server-side, so the card stays open with
      // the error rather than silently discarding what was typed.
      if (!result?.ok) {
        setError(result?.error ?? "Couldn't save that contact.");
        return;
      }
      close();
    });
  }

  if (!expanded) {
    return (
      <Button type="button" onClick={() => setExpanded(true)} className="w-full justify-center">
        <Icon name="plus" size={18} />
        Add contact
      </Button>
    );
  }

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="h-1.5 bg-accent" />
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Add contact</h2>
          <button type="button" onClick={close} className="text-sm text-ink-muted hover:text-ink">
            Cancel
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="e.g. Cara"
              className="rounded-button border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">
              Phone number <span className="text-ink-muted">(optional)</span>
            </span>
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+65 9123 4567"
              className="rounded-button border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
            <span className="text-xs text-ink-muted">
              Saved for your reference only — never messaged or notified.
            </span>
          </label>

          {error ? <p className="text-sm text-danger-strong">{error}</p> : null}

          <Button
            type="button"
            onClick={submit}
            disabled={pending || name.trim().length === 0}
            className="w-full justify-center"
          >
            {pending ? "Saving…" : "Save contact"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
