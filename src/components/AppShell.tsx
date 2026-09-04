"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { MobileFrame } from "@/components/MobileFrame";
import { ScanPayIntro, type ScanPayStage } from "@/components/ScanPayIntro";
import {
  MAIN_NAV_ITEMS,
  MORE_NAV_ITEMS,
  NAV_ITEMS_BEFORE_CENTER,
  SCAN_ACTION,
  type NavItem,
} from "@/lib/nav";
import { logout } from "@/app/auth/actions";

// How long the Scan & Pay intro's Face ID beat auto-plays before advancing —
// tap-to-skip (ScanPayIntro's onSkip) can always cut this short.
//
// NFC_STAGE_MS/the "nfc" stage below are ScanPayIntro's — its "Hold Near
// Reader" animation belongs to a different (NFC-tap) payment method, not
// Scan & Pay, so the raised action never triggers it; kept only so the
// timed nfc -> faceid handoff still works correctly if something else ever
// legitimately starts this intro at "nfc".
const NFC_STAGE_MS = 1400;
const FACEID_STAGE_MS = 1500;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// THE single shared layout wrapper for every authenticated page — mounted
// once by src/app/(app)/layout.tsx, so every route renders as `children`
// inside it. Frame geometry comes from MobileFrame; content side padding is
// set here. No page under src/app/(app)/ may set its own
// max-w-*/container/mx-auto/side-padding.
//
// Bottom nav is 5 slots: Home, Activity, the raised Scan & Pay action,
// Rewards, and More (a bottom sheet holding Overseas/Contacts/Profile — see
// src/lib/nav.ts for why Split/Bills/Budget are NOT in it).
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  // null = not showing. Tapping the raised action starts straight at
  // "faceid" (Scan & Pay's own animation — never "nfc"/"Hold Near Reader",
  // which is a different payment method's animation) instead of navigating
  // immediately; the effect below advances it to SCAN_ACTION.href once the
  // Face ID beat finishes — the actual destination (the existing scan/split
  // page) is unchanged, this only delays reaching it.
  const [scanStage, setScanStage] = useState<ScanPayStage | null>(null);

  const finishScanIntro = useCallback(() => {
    setScanStage(null);
    router.push(SCAN_ACTION.href);
  }, [router]);

  // Escape closes the sheet, like any dismissible overlay.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  // Escape also skips the Scan & Pay intro straight to its destination.
  useEffect(() => {
    if (!scanStage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finishScanIntro();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scanStage, finishScanIntro]);

  // Auto-advances faceid -> navigate (or, if some future caller ever starts
  // this at "nfc", nfc -> faceid -> navigate). Purely a timed UI transition
  // — no Server Action, no data fetch, nothing payment-related happens here.
  useEffect(() => {
    if (!scanStage) return;
    if (scanStage === "nfc") {
      const timer = setTimeout(() => setScanStage("faceid"), NFC_STAGE_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(finishScanIntro, FACEID_STAGE_MS);
    return () => clearTimeout(timer);
  }, [scanStage, finishScanIntro]);

  const leftTabs = MAIN_NAV_ITEMS.slice(0, NAV_ITEMS_BEFORE_CENTER);
  const rightTabs = MAIN_NAV_ITEMS.slice(NAV_ITEMS_BEFORE_CENTER);

  // "More" reads as active for any route it owns that isn't the center
  // action's own destination (that one highlights the raised button instead).
  const moreActive = MORE_NAV_ITEMS.some(
    (item) => item.href !== SCAN_ACTION.href && isActive(pathname, item.href),
  );

  return (
    <MobileFrame>
      {/* Top bar — fixed row, never scrolls */}
      <header className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-4 py-3">
        <Link href="/home" className="flex items-center gap-1 text-base font-semibold text-accent">
          <Image src="/nets-logo.png" alt="NETS" width={627} height={163} className="h-4 w-auto" />
          Quest
        </Link>
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

      {/* Content — the ONLY scrolling region. Every page renders here with no
          width/padding of its own. */}
      <main className="min-h-0 flex-1 overflow-y-auto bg-canvas">
        <div className="px-4 pb-8 pt-6">{children}</div>
      </main>

      {/* More sheet — backdrop + panel, both always mounted so open/close is a
          real CSS transition (no animation library). */}
      <div
        onClick={() => setMoreOpen(false)}
        aria-hidden="true"
        className={
          "absolute inset-0 z-20 bg-black/40 transition-opacity duration-200 " +
          (moreOpen ? "opacity-100" : "pointer-events-none opacity-0")
        }
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More"
        inert={!moreOpen}
        className={
          "absolute inset-x-0 bottom-0 z-30 rounded-t-card border-t border-line bg-surface p-4 transition-transform duration-200 ease-out " +
          (moreOpen ? "translate-y-0" : "translate-y-full")
        }
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-200" />
        <div className="flex flex-col">
          {MORE_NAV_ITEMS.map((item) => (
            <MoreRow
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              onNavigate={() => setMoreOpen(false)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMoreOpen(false)}
          className="mt-2 w-full rounded-button border border-line px-4 py-2 text-sm font-medium text-ink"
        >
          Close
        </button>
      </div>

      {/* Scan & Pay intro — sits above the More sheet (z-40 > z-30). Only
          mounted while playing, so it never intercepts clicks otherwise. */}
      {scanStage ? <ScanPayIntro stage={scanStage} onSkip={finishScanIntro} /> : null}

      {/* Bottom tabs — 5 slots, center raised out of the bar */}
      <nav className="relative z-10 grid shrink-0 grid-cols-5 border-t border-line bg-surface">
        {leftTabs.map((item) => (
          <Tab key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        {/* Center slot: the raised circular action. Absolutely positioned and
            pulled above the bar so it pops out rather than sitting flush.
            A button, not a Link — tapping starts the Scan & Pay intro
            straight at its Face ID beat (never "Hold Near Reader" — see the
            scanStage comment above), which navigates to SCAN_ACTION.href
            itself once done/skipped, rather than navigating immediately. */}
        <div className="relative flex flex-col items-center justify-end py-2">
          <button
            type="button"
            onClick={() => setScanStage("faceid")}
            aria-label={SCAN_ACTION.label}
            aria-current={isActive(pathname, SCAN_ACTION.href) ? "page" : undefined}
            className={
              "absolute -top-6 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-surface transition-colors " +
              (isActive(pathname, SCAN_ACTION.href)
                ? "bg-accent-strong"
                : "bg-accent hover:bg-accent-strong")
            }
          >
            <Icon name={SCAN_ACTION.icon} size={24} />
          </button>
          {/* No text label here (unlike the other 4 tabs) — it was crowding
              this slot, and the raised, larger, distinctly-colored circular
              button is already the visually loudest element in the bar, so
              it reads as its own tappable action without one. */}
        </div>

        {rightTabs.map((item) => (
          <Tab key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={
            "flex flex-col items-center gap-1 py-2 text-xs " +
            (moreActive || moreOpen ? "text-accent" : "text-ink-muted")
          }
        >
          <Icon name="plus" size={22} />
          <span className="text-xs leading-none">More</span>
        </button>
      </nav>
    </MobileFrame>
  );
}

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
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
}

function MoreRow({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={
        "flex items-center gap-3 rounded-button px-2 py-3 text-sm font-medium " +
        (active ? "bg-nets-blue-100 text-accent" : "text-ink hover:bg-surface-muted")
      }
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
        <Icon name={item.icon} size={18} />
      </span>
      {item.label}
    </Link>
  );
}
