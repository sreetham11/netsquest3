// No client-safety concerns (pure string logic) and no server-only data
// access — usable from both server and client components.

// This app only ever collects an email at signup (see src/app/auth/AuthForm.tsx
// — no name field exists anywhere), so every display name is derived from it.
// Shared so seed.ts's demo Split participant naming and the More page's
// profile card can't drift into two different derivations of "the same"
// name for the same account.
export function displayNameFromEmail(email: string): string {
  return email.split("@")[0].replace(/[+.].*$/, "") || "You";
}
