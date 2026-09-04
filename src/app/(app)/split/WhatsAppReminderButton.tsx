"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { sendWhatsAppReminder } from "../actions";

// Uses useTransition + a direct action call (same pattern as spinSplit in
// SpinToDecide) rather than useActionState — no form fields, just a
// participant id, and the result needs to render inline (sent / error)
// right where it's known.
export function WhatsAppReminderButton({ participantId }: { participantId: string }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function send() {
    if (pending || sent) return;
    setError("");
    startTransition(async () => {
      const result = await sendWhatsAppReminder(participantId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={send}
        disabled={pending || sent}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-strong disabled:cursor-default disabled:opacity-60"
      >
        <Icon name="message" size={13} />
        {pending ? "Sending…" : sent ? "Reminder sent" : "Send Reminder"}
      </button>

      {/* A persistent note, not a hover-only tooltip — this is a touch-first
          mobile app, so anything hover-only would never be seen. */}
      {!sent && !error ? (
        <p className="text-[11px] text-ink-muted">
          They must have joined our WhatsApp sandbox first — a one-time step on their end.
        </p>
      ) : null}

      {error ? <p className="text-xs text-danger-strong">{error}</p> : null}
    </div>
  );
}
