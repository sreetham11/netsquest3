"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CompassMark } from "@/components/CompassMark";
import { MobileFrame } from "@/components/MobileFrame";
import type { AuthState } from "./actions";

type Props = {
  mode: "login" | "signup";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
};

// Renders inside the same MobileFrame as the rest of the app, so login/signup
// match the authenticated screens exactly — same 390px width, same border /
// shadow / rounding. No nested card border here: the frame IS the card.
// Content is vertically centered when it fits and scrolls inside the frame
// when it doesn't (min-h-full + justify-center inside the scroll region).
export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    null,
  );

  const isSignup = mode === "signup";

  return (
    <MobileFrame>
      {/* px-4 matches AppShell + /welcome so the content left edge is
          identical on every screen. The block below is centred in the free
          space exactly the way /welcome centres its hero, so the two screens
          share a vertical rhythm; the sign-up line is the bottom anchor. The
          brand mark occupies the space above the heading, so this reads as
          composition rather than the empty gap it used to be. */}
      <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-deep-navy px-4 pb-8 pt-8">
        {/* Marina Bay Sands background photo — cover + centered so it scales
            to fill the frame at any height without distorting. Sits behind
            everything else (first in DOM, position:absolute with no
            z-index, so later siblings stack on top of it naturally). */}
        <Image
          src="/login-marina-bay.jpg"
          alt=""
          fill
          priority
          sizes="390px"
          className="object-cover"
        />

        {/* Dark gradient overlay — deep-navy (the existing brand token, not
            raw black) so the photo tints toward the app's own pre-login
            palette instead of reading as a generic dark filter. Darkest at
            the bottom where the form sits, since white input LABELS (the
            inputs themselves are opaque white fields, already readable
            regardless) need the most contrast there. */}
        <div className="absolute inset-0 bg-gradient-to-b from-deep-navy/60 via-deep-navy/80 to-deep-navy/95" />

        {/* Two thin light-streak curves across the lower background. Pure SVG,
            low opacity, decorative only. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-56 w-full"
          viewBox="0 0 390 224"
          fill="none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="streak-a" x1="0" y1="0" x2="390" y2="0">
              <stop offset="0%" stopColor="var(--color-brand-blue)" stopOpacity="0" />
              <stop offset="50%" stopColor="var(--color-brand-blue)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--color-brand-blue)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="streak-b" x1="0" y1="0" x2="390" y2="0">
              <stop offset="0%" stopColor="var(--color-brand-red)" stopOpacity="0" />
              <stop offset="55%" stopColor="var(--color-brand-red)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--color-brand-red)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M-20 150 C 90 96, 250 196, 410 118" stroke="url(#streak-a)" strokeWidth="1.5" />
          <path d="M-20 196 C 110 150, 240 232, 410 168" stroke="url(#streak-b)" strokeWidth="1.5" />
        </svg>

        <div className="relative flex flex-1 flex-col justify-center">
          {/* Hero mark — the splash compass at ~2.5x its old size, with a soft
              radial glow behind it and a drop-shadow on the ring for lift. */}
          <div className="relative flex justify-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span className="h-32 w-32 rounded-full bg-brand-blue/30 blur-2xl" />
              <span className="absolute h-20 w-20 rounded-full bg-brand-red/30 blur-2xl" />
            </div>
            <span className="relative drop-shadow-lg">
              <CompassMark size={100} sheen />
            </span>
          </div>

          <p className="mt-5 text-center text-2xl font-bold tracking-tight text-white">
            NETS QUEST
          </p>
          <p className="mt-1 text-center text-sm text-nets-blue-100">
            Find your next reward
          </p>

          <h1 className="mt-8 text-2xl font-bold tracking-tight text-white">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>

          <form action={formAction} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-white">Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="rounded-button border border-line bg-surface px-3 py-2 text-base text-ink outline-none focus:border-accent"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-white">Password</span>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                autoComplete={isSignup ? "new-password" : "current-password"}
                className="rounded-button border border-line bg-surface px-3 py-2 text-base text-ink outline-none focus:border-accent"
              />
            </label>

            {state?.error ? (
              <p className="text-sm text-brand-red" role="alert">
                {state.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="mt-2 w-full rounded-full bg-linear-to-r from-brand-red to-brand-blue px-4 py-2.5 text-base font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
            >
              {pending
                ? isSignup
                  ? "Creating account…"
                  : "Signing in…"
                : isSignup
                  ? "Sign up"
                  : "Sign in"}
            </button>
          </form>

        </div>

        {/* Natural bottom anchor, the way /welcome anchors its CTA. */}
        <p className="relative pt-8 text-sm text-nets-blue-100">
          {isSignup ? "Already have an account? " : "Need an account? "}
          <Link
            href={isSignup ? "/login" : "/signup"}
            className="font-medium text-white underline"
          >
            {isSignup ? "Sign in" : "Sign up"}
          </Link>
        </p>
      </main>
    </MobileFrame>
  );
}
