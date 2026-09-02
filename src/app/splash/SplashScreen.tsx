"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CompassMark } from "@/components/CompassMark";
import { MobileFrame } from "@/components/MobileFrame";
import { PeopleSilhouettes } from "@/components/PeopleSilhouettes";

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
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-deep-navy"
      >
        {/* Background texture layer — behind everything else below, purely
            decorative. `absolute` takes it out of this flex container's
            layout entirely, so it doesn't affect the centering of the
            compass/wordmark. */}
        <PeopleSilhouettes />

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
            "relative text-2xl font-semibold tracking-tight text-white transition-opacity duration-700 ease-out " +
            (shown ? "opacity-100 delay-150" : "opacity-0")
          }
        >
          NETS Quest
        </span>
      </button>
    </MobileFrame>
  );
}
