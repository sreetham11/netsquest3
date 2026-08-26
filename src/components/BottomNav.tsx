"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { NAV_ITEMS } from "@/lib/nav";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Extracted out of AppShell so the Pay scan screen (which needs its own dark
// full-bleed top chrome, not AppShell's standard header — matching
// scan_pay/screen.png, which keeps the bottom nav but replaces the top bar
// with a back button + title) can reuse the exact same bottom nav without
// duplicating the Pay-tab diamond treatment in two places.
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex h-20 items-center justify-around border-t border-border-light bg-surface-container-lowest pb-safe lg:hidden">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);

        if (item.href === "/pay") {
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative -top-5 flex flex-col items-center gap-1.5"
            >
              <span className="flex h-14 w-14 rotate-45 items-center justify-center rounded-lg bg-gradient-to-b from-nets-blue-gradient-start to-primary shadow-[0_8px_20px_rgb(0,102,255,0.3)]">
                <Icon name={item.icon} size={24} className="-rotate-45 text-on-primary" />
              </span>
              <span className={"text-label-md text-primary " + (active ? "font-bold" : "font-medium")}>
                {item.label}
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              "flex flex-col items-center gap-1 " + (active ? "text-primary" : "text-on-surface-variant")
            }
          >
            <Icon name={item.icon} size={24} />
            <span className={"text-label-md " + (active ? "font-bold" : "font-medium")}>
              {item.shortLabel}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
