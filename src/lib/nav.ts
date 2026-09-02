import type { IconName } from "@/components/Icon";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: IconName;
};

// Bottom nav is 5 slots: two tabs, the raised Scan & Pay action, one tab, and
// a "More" menu holding the rest. Every route still exists and works exactly
// as before — the ones no longer on the bar are reached through More.

// Tabs that sit flush in the bar, in slot order around the center action.
export const MAIN_NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", shortLabel: "Home", icon: "home" },
  { href: "/transactions", label: "Transactions", shortLabel: "Activity", icon: "transactions" },
  { href: "/rewards", label: "Rewards", shortLabel: "Rewards", icon: "rewards" },
];

// How many tabs render to the LEFT of the raised center action; the rest go
// to its right. Keeps AppShell from hardcoding a slice index.
export const NAV_ITEMS_BEFORE_CENTER = 2;

// Center slot — the raised action. Points at the receipt-scan flow, which
// lives on /split (NewSplitForm's "Scan receipt" mode).
export const SCAN_ACTION: NavItem = {
  href: "/split",
  label: "Scan & Pay",
  shortLabel: "Scan & Pay",
  icon: "camera",
};

// Everything reached through the "More" menu rather than a dedicated tab.
export const MORE_NAV_ITEMS: NavItem[] = [
  { href: "/split", label: "Split", shortLabel: "Split", icon: "split" },
  { href: "/overseas", label: "Overseas", shortLabel: "Overseas", icon: "overseas" },
  { href: "/bills", label: "Bills", shortLabel: "Bills", icon: "bills" },
  { href: "/budget", label: "Budget", shortLabel: "Budget", icon: "budget" },
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

export const PROTECTED_PREFIXES = Array.from(
  new Set([...ALL_NAV_ITEMS.map((i) => i.href), SCAN_ACTION.href]),
);
