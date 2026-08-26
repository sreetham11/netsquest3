"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { NAV_ITEMS, SECONDARY_ITEMS, type NavItem } from "@/lib/nav";
import { logout } from "@/app/auth/actions";
import { BottomNav } from "@/components/BottomNav";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({ item, active, compact = false }: { item: NavItem; active: boolean; compact?: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={
        "flex items-center gap-3 rounded-lg px-3 py-2 text-body-lg font-medium " +
        (active
          ? "bg-primary/10 text-primary"
          : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface")
      }
    >
      <Icon name={item.icon} size={compact ? 18 : 20} />
      {item.label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-full bg-background">
      {/* Desktop sidebar (>=1024px) */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border-light bg-surface-container-lowest lg:flex">
        <div className="px-6 py-6">
          <span className="text-title-lg text-primary">NETS Quest</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}

          {/* Desktop-only section — Stitch didn't design a desktop nav, so this
              grouping is my own call, not a translated screen. Split/Overseas/
              Bills/Budget moved off the primary nav because mobile's 5-tab bar
              has no room for 9 items; that constraint doesn't exist on desktop,
              so rather than also hide them behind the mobile-pattern More hub
              here, they get their own labeled section in the same sidebar —
              still one click away, just visually secondary (smaller icon,
              muted default color), instead of a detour through /more. */}
          <p className="mb-1 mt-6 px-3 text-label-md uppercase tracking-wide text-on-surface-variant">
            More
          </p>
          {SECONDARY_ITEMS.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} compact />
          ))}
        </nav>
        <div className="p-3">
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-body-lg font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            >
              <Icon name="logout" size={20} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar (<1024px) */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border-light bg-background/90 px-4 py-3 backdrop-blur-md lg:hidden">
        <span className="text-title-lg text-primary">NETS Quest</span>
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-body-md font-medium text-on-surface-variant"
          >
            <Icon name="logout" size={18} />
            Sign out
          </button>
        </form>
      </header>

      {/* Content — identical max-width / padding / top-offset on every page */}
      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6 lg:pb-12 lg:pt-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom tabs — extracted to BottomNav.tsx so the Pay scan
          screen (custom top chrome, standard bottom nav) can reuse it
          without duplicating the Pay-tab diamond treatment. See that file's
          comment for the "why standardize on home/screen.png's treatment"
          reasoning. */}
      <BottomNav />
    </div>
  );
}
