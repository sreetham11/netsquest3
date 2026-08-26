import type { IconName } from "@/components/Icon";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: IconName;
};

// Single source of truth for app navigation. Used by AppShell (sidebar + bottom
// tabs) and by the proxy to gate protected routes.
export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", shortLabel: "Home", icon: "home" },
  { href: "/transactions", label: "Transactions", shortLabel: "Activity", icon: "transactions" },
  { href: "/split", label: "Split", shortLabel: "Split", icon: "split" },
  { href: "/rewards", label: "Rewards", shortLabel: "Rewards", icon: "rewards" },
  { href: "/overseas", label: "Overseas", shortLabel: "Overseas", icon: "overseas" },
  { href: "/bills", label: "Bills", shortLabel: "Bills", icon: "bills" },
  { href: "/budget", label: "Budget", shortLabel: "Budget", icon: "budget" },
];

export const PROTECTED_PREFIXES = NAV_ITEMS.map((i) => i.href);
