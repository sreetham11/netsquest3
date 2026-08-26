"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { NAV_ITEMS } from "@/lib/nav";
import { logout } from "@/app/auth/actions";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-full bg-canvas">
      {/* Desktop sidebar (>=1024px) */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-6 py-6">
          <span className="text-lg font-semibold text-accent">NETS Quest</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "flex items-center gap-3 rounded-button px-3 py-2 text-sm font-medium " +
                  (active
                    ? "bg-nets-blue-100 text-accent"
                    : "text-ink-muted hover:bg-surface-muted hover:text-ink")
                }
              >
                <Icon name={item.icon} size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-button px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
            >
              <Icon name="logout" size={20} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar (<1024px) */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <span className="text-base font-semibold text-accent">NETS Quest</span>
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-button px-2 py-1 text-sm font-medium text-ink-muted"
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

      {/* Mobile bottom tabs (<1024px) */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-7 border-t border-line bg-surface lg:hidden">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                "flex flex-col items-center gap-1 py-2 text-xs " +
                (active ? "text-accent" : "text-ink-muted")
              }
            >
              <Icon name={item.icon} size={22} />
              <span className="text-xs leading-none">{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
