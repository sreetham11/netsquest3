"use client";

import { useState } from "react";
import { Toggle } from "@/components/ui/Toggle";

// Local UI state only — resets on reload, not wired to any real PIN/biometric
// logic or persisted anywhere. Purely a display/preference toggle for now.
export function SecurityToggles() {
  const [requirePin, setRequirePin] = useState(false);
  const [biometric, setBiometric] = useState(false);

  return (
    <div className="divide-y divide-line px-6">
      <div className="flex items-center justify-between gap-4 py-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Require PIN to pay</p>
          <p className="text-sm text-ink-muted">Ask for a PIN before confirming any payment.</p>
        </div>
        <Toggle checked={requirePin} onChange={setRequirePin} label="Require PIN to pay" />
      </div>
      <div className="flex items-center justify-between gap-4 py-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Biometric login</p>
          <p className="text-sm text-ink-muted">Use Face ID or fingerprint to sign in.</p>
        </div>
        <Toggle checked={biometric} onChange={setBiometric} label="Biometric login" />
      </div>
    </div>
  );
}
