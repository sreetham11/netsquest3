import type { IconName } from "@/components/Icon";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: IconName;
};

// Bottom nav is 5 slots: two tabs, the raised Scan & Pay action, one tab, and
// a "More" menu. Every route still exists and works exactly as before, but
// More is NOT simply "everything not on the bar" — Split/Bills/Budget/Top up/
// Auto Top-up all have their own entry point already (Home's action tile
// row), so putting them in More too would just be a second, redundant path
// to something already one tap away. More holds only what has NO other entry
// point: Overseas, Contacts, Profile.

// Tabs that sit flush in the bar, in slot order around the center action.
export const MAIN_NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", shortLabel: "Home", icon: "home" },
  { href: "/transactions", label: "Transactions", shortLabel: "Activity", icon: "transactions" },
  { href: "/rewards", label: "Rewards", shortLabel: "Rewards", icon: "rewards" },
];

// How many tabs render to the LEFT of the raised center action; the rest go
// to its right. Keeps AppShell from hardcoding a slice index.
export const NAV_ITEMS_BEFORE_CENTER = 2;

// Center slot — the raised action. Points at the real merchant-payment flow
// (/pay, backed by the makePayment Server Action) — NOT /split. Split is a
// separate, independent flow reached only via its own More entry below.
// Split's own "Scan & Pay" button (split/page.tsx) does reuse this SCAN_ACTION
// href, appending its own `?from=split` marker so a completed payment can
// offer "Split this?" — this bottom-nav entry point never adds that marker,
// so a payment started here behaves exactly as before.
export const SCAN_ACTION: NavItem = {
  href: "/pay",
  label: "Scan & Pay",
  shortLabel: "Scan & Pay",
  icon: "camera",
};

// Everything reached through the "More" menu — deliberately NOT Split/Bills/
// Budget (Home's action tile row already reaches those directly; see the
// comment above). Zero overlap with Home's tiles by construction.
export const MORE_NAV_ITEMS: NavItem[] = [
  { href: "/overseas", label: "Overseas", shortLabel: "Overseas", icon: "overseas" },
  { href: "/contacts", label: "Contacts", shortLabel: "Contacts", icon: "contacts" },
  { href: "/profile", label: "Profile", shortLabel: "Profile", icon: "settings" },
];

// Every in-app route, regardless of how it is reached. PROTECTED_PREFIXES is
// derived from THIS — dropping a route from the bar must never drop it from
// the proxy's auth gate.
export const ALL_NAV_ITEMS: NavItem[] = [
  ...MAIN_NAV_ITEMS,
  ...MORE_NAV_ITEMS.filter(
    (item) => !MAIN_NAV_ITEMS.some((main) => main.href === item.href),
  ),
];

// Routes that exist and must stay auth-gated but aren't reachable from a nav
// bar row/sheet at all — they're only reachable from a Home action tile.
// Split/Bills/Budget used to also live in MORE_NAV_ITEMS (a duplicate entry
// point, removed above); kept here so removing them from the sheet can't
// silently drop them from the proxy's auth gate.
const EXTRA_PROTECTED_ROUTES = [
  "/split",
  "/bills",
  "/budget",
  "/topup",
  "/auto-topup",
  "/savings-goals",
];

export const PROTECTED_PREFIXES = Array.from(
  new Set([
    ...ALL_NAV_ITEMS.map((i) => i.href),
    SCAN_ACTION.href,
    ...EXTRA_PROTECTED_ROUTES,
  ]),
);
