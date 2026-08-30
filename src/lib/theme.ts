"use client";

// Client-only theme control: toggles the .dark class the globals.css dark
// palette hooks into, and persists the explicit choice. Deliberately NOT a
// React context/store — there's exactly one control that reads/writes this
// (ThemeToggle), so a shared module with plain functions is simpler than
// wiring a provider through the tree for a single consumer.
const STORAGE_KEY = "theme";

export type Theme = "dark" | "light";

// Listener set for useSyncExternalStore (ThemeToggle) — the .dark class is
// external, mutable state (not React state), and useSyncExternalStore is the
// React-sanctioned way to read + re-render on changes to that kind of source
// without a setState-in-an-effect (which cascades an extra render and is
// flagged by react-hooks/set-state-in-effect for good reason: it's usually
// a sign the state should either be derived during render or, as here,
// modeled as an external store instead).
const listeners = new Set<() => void>();

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isDarkActive(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

// Matches the server-rendered snapshot (no document, so always "light") —
// the pre-hydration script in layout.tsx has already corrected the real DOM
// class by the time this runs, useSyncExternalStore just needs an SSR-safe
// value to reconcile against without a hydration mismatch.
export function getServerTheme(): boolean {
  return false;
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private-browsing/storage-blocked contexts can throw — the toggle still
    // visually applies for this session, it just won't survive a reload.
  }
  listeners.forEach((l) => l());
}
