import type { IconName } from "@/components/Icon";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: IconName;
};

// Primary nav — exactly 5 items, per DESIGN.md's Bottom Navigation spec
// ("5 tabs: Home, Pay (Central, prominent), Activity, Rewards, More") and
// every reference screen's own bottom-nav markup, which all agree on this
// exact order. Drives both AppShell's mobile bottom-tab bar and the top
// group of its desktop sidebar.
//
// /pay and /more don't have real pages yet (Phase 4 and Phase 5 build them)
// — linking to them now is intentional per the phase ordering, not a mistake;
// they 404 until their own phase lands.
export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", shortLabel: "Home", icon: "home" },
  { href: "/pay", label: "Pay", shortLabel: "Pay", icon: "qr-code" },
  { href: "/transactions", label: "Activity", shortLabel: "Activity", icon: "transactions" },
  { href: "/rewards", label: "Rewards", shortLabel: "Rewards", icon: "rewards" },
  { href: "/more", label: "More", shortLabel: "More", icon: "more" },
];

// Moved off the primary nav (mobile's 5-tab bar has no room for them) but
// still fully live routes — reached via the More hub on mobile and a
// secondary sidebar section on desktop. See AppShell.tsx for why desktop
// surfaces these directly instead of also hiding them behind /more.
export const SECONDARY_ITEMS: NavItem[] = [
  { href: "/split", label: "Split", shortLabel: "Split", icon: "split" },
  { href: "/overseas", label: "Overseas", shortLabel: "Overseas", icon: "overseas" },
  { href: "/bills", label: "Bills", shortLabel: "Bills", icon: "bills" },
  { href: "/budget", label: "Budget", shortLabel: "Budget", icon: "budget" },
];

// Every real authenticated route, for the proxy's edge-level auth gate.
// Deliberately NOT just NAV_ITEMS.map(...) anymore: before this phase, "in
// primary nav" and "needs auth" were the same 7 routes, so one list served
// both. Now that NAV_ITEMS is a curated 5-item subset, deriving protection
// from it alone would silently drop Split/Overseas/Bills/Budget from the
// fast edge-middleware redirect (page-level requireUser() in
// (app)/layout.tsx would still catch a signed-out visit, so it's not an
// actual hole — but it'd be a needless regression of the faster gate, easy
// to miss since nothing would visibly break). Kept explicit instead.
export const PROTECTED_PREFIXES = [...NAV_ITEMS, ...SECONDARY_ITEMS].map((i) => i.href);
