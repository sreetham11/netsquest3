"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CompassMark } from "@/components/CompassMark";
import { MobileFrame } from "@/components/MobileFrame";
import { NetsCredit } from "@/components/NetsCredit";

const SPLASH_MS = 2500;

// Splash: auto-advances to /welcome after 2.5s, or immediately on tap —
// whichever comes first. `replace` (not push) so Back never returns here.
// The fade-in is a plain CSS transition toggled on mount; no animation lib.
export function SplashScreen() {
  const router = useRouter();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Next frame, so the transition has an initial state to animate from.
    const raf = requestAnimationFrame(() => setShown(true));
    const timer = setTimeout(() => router.replace("/welcome"), SPLASH_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <MobileFrame>
      <button
        type="button"
        onClick={() => router.replace("/welcome")}
        aria-label="Skip to welcome"
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-splash-navy"
      >
        {/* Background illustration + credit, grouped into one bottom-anchored
            stack — decorative, `absolute` so it takes no part in the flex
            centering of the compass/wordmark above. The group (not the image
            alone) sits flush against the bottom edge; the illustration comes
            FIRST inside it so the credit renders directly below the people,
            never overlapping them (it used to, back when both were
            independently bottom-anchored). bg-splash-navy above is
            hand-matched to this file's own flat navy (see globals.css) so
            the CSS fill and the image read as one continuous surface above
            it, with no visible seam. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
          <Image
            src="/splash-illustration.png"
            alt=""
            aria-hidden
            width={1440}
            height={717}
            priority
            className="h-auto w-full select-none"
          />
          <div
            className={
              "pb-8 transition-opacity duration-700 ease-out " +
              (shown ? "opacity-100 delay-300" : "opacity-0")
            }
          >
            <NetsCredit tone="on-dark" priority />
          </div>
        </div>

        <span
          className={
            "relative transition-all duration-700 ease-out " +
            (shown ? "scale-100 opacity-100" : "scale-95 opacity-0")
          }
        >
          <CompassMark />
        </span>

        <span
          className={
            "relative flex items-center gap-1.5 text-2xl font-semibold tracking-tight text-white transition-opacity duration-700 ease-out " +
            (shown ? "opacity-100 delay-150" : "opacity-0")
          }
        >
          <Image src="/nets-logo.png" alt="NETS" width={627} height={163} className="h-6 w-auto" />
          Quest
        </span>
      </button>
    </MobileFrame>
  );
}
