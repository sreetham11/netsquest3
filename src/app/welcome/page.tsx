import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompassMark } from "@/components/CompassMark";
import { MobileFrame } from "@/components/MobileFrame";
import { PeopleSilhouettes } from "@/components/PeopleSilhouettes";
import { Icon, type IconName } from "@/components/Icon";

// Three one-line highlights, to give the middle of the screen something to do
// instead of leaving it as dead space. Icons all come from the existing set.
const HIGHLIGHTS: Array<{ icon: IconName; label: string }> = [
  { icon: "split", label: "Pay & split bills" },
  { icon: "budget", label: "Track spending" },
  { icon: "rewards", label: "Earn NETS Miles" },
];

// Second (and last) pre-login screen. Static — hero mark, headline, one
// supporting line, three highlights, and a single full-width gradient CTA into
// the existing /login page. A signed-in visitor skips straight to /home, same
// as /splash.
export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/home");

  return (
    <MobileFrame>
      {/* Same scattered-silhouette background texture as /splash, replacing
          the old flat navy-tinted gradient — consistent treatment across
          both pre-login screens. bg-canvas is the plain base fill it sits
          on top of. */}
      <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-canvas px-4 pb-8 pt-8">
        <PeopleSilhouettes variant="compact" />

        {/* Everything above the CTA is centred in the free space, so leftover
            height is split evenly above and below the block instead of piling
            into one dead gap. relative so it (and the CTA below) paint above
            the absolute background layer. */}
        <div className="relative flex flex-1 flex-col justify-center">
        {/* Hero: the same compass mark as /splash, larger, over a soft radial
            glow built from the two brand colors. */}
        <div className="relative flex justify-center py-2">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="h-36 w-36 rounded-full bg-brand-blue/25 blur-2xl" />
            <span className="absolute h-24 w-24 rounded-full bg-brand-red/25 blur-2xl" />
          </div>
          <span className="relative">
            <CompassMark size={112} />
          </span>
        </div>

        {/* Hero statement — bold and tight against a lighter, smaller body
            line so the hierarchy reads clearly. */}
        <h1 className="mt-8 text-2xl font-bold leading-tight tracking-tight text-ink">
          Your everyday payment companion
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Pay, split bills, track spending, and earn rewards — all in one wallet
          built for the way you actually spend.
        </p>

        <ul className="mt-8 flex flex-col gap-3">
          {HIGHLIGHTS.map((item) => (
            <li key={item.label} className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-accent">
                <Icon name={item.icon} size={18} />
              </span>
              <span className="text-sm font-medium text-ink">{item.label}</span>
            </li>
          ))}
          </ul>
        </div>

        {/* Primary CTA sits in the thumb zone at the bottom of the frame. */}
        <Link
          href="/login"
          className="relative mt-8 w-full rounded-full bg-linear-to-r from-brand-red to-brand-blue px-4 py-3.5 text-center text-base font-semibold text-white transition-opacity duration-200 hover:opacity-90"
        >
          Get Started
        </Link>
      </main>
    </MobileFrame>
  );
}
