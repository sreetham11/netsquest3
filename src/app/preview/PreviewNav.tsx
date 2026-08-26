"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";

// Deliberately NOT the real BottomNav — that links to /home, /pay,
// /transactions, /rewards, /more (real, auth-gated routes). This only ever
// links within /preview/* so a visitor can click around the mock-data
// preview without ever hitting the real app or its auth gate.
const ITEMS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/preview/home", label: "Home", icon: "home" },
  { href: "/preview/pay", label: "Pay", icon: "qr-code" },
  { href: "/preview/activity", label: "Activity", icon: "transactions" },
  { href: "/preview/rewards", label: "Rewards", icon: "rewards" },
  { href: "/preview/more", label: "More", icon: "more" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PreviewNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex h-20 items-center justify-around border-t border-border-light bg-surface-container-lowest pb-safe">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={"flex flex-col items-center gap-1 " + (active ? "text-primary" : "text-on-surface-variant")}
          >
            <Icon name={item.icon} size={24} />
            <span className={"text-label-md " + (active ? "font-bold" : "font-medium")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
