"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { createContact } from "../actions";

// Name and phone number are both required (see createContact) — phone is
// still cosmetic/reference-only (never messaged), but a saved payee with no
// number defeats the PayNow-style "looks like a real contact" point of this
// list, so it's required at entry the same way name is.
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
    const trimmedName = name.trim();
    const trimmedPhone = phoneNumber.trim();
    if (!trimmedName) return;
    // Belt-and-suspenders alongside the disabled Save button — the name
    // field's Enter-to-submit handler below calls this directly, bypassing
    // the button's disabled attribute.
    if (!trimmedPhone) {
      setError("Enter a phone number.");
      return;
    }
    setError("");

    startTransition(async () => {
      const formData = new FormData();
      formData.append("name", trimmedName);
      formData.append("phoneNumber", trimmedPhone);
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
            <span className="text-sm font-medium text-ink">Phone number</span>
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
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
            disabled={pending || name.trim().length === 0 || phoneNumber.trim().length === 0}
            className="w-full justify-center"
          >
            {pending ? "Saving…" : "Save contact"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
