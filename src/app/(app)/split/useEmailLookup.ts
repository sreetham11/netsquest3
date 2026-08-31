"use client";

import { useEffect, useState } from "react";
import { findRegisteredUserByEmail, type UserLookupResult } from "../actions";

// Debounced strict lookup, shared by every "who's splitting it" input
// (NewSplitForm, and Smart Split's own "choose who to split with" step) —
// findRegisteredUserByEmail itself refuses to match anything until the input
// looks like a complete email, so this only ever fires a real query once
// there's something worth checking, not on every keystroke of a short
// partial string. Blank input returns null without needing an effect-driven
// reset — the trailing `nameInput.trim() ? matchedUser : null` guards
// against showing a stale match left over from a since-cleared input.
export function useEmailLookup(nameInput: string): UserLookupResult {
  const [matchedUser, setMatchedUser] = useState<UserLookupResult>(null);

  useEffect(() => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await findRegisteredUserByEmail(trimmed);
      if (!cancelled) setMatchedUser(result);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [nameInput]);

  return nameInput.trim() ? matchedUser : null;
}
