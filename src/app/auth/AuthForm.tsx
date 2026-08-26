"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthState } from "./actions";

type Props = {
  mode: "login" | "signup";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
};

export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    null,
  );

  const isSignup = mode === "signup";

  return (
    <main className="flex min-h-full items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-8">
        <h1 className="text-2xl font-semibold text-accent">NETS Quest</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {isSignup ? "Create your account" : "Sign in to your account"}
        </p>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="rounded-button border border-line bg-surface px-3 py-2 text-base text-ink outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">Password</span>
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
            <p className="text-sm text-danger-strong" role="alert">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-button bg-accent px-4 py-2 text-base font-medium text-white disabled:opacity-60"
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

        <p className="mt-6 text-sm text-ink-muted">
          {isSignup ? "Already have an account? " : "Need an account? "}
          <Link
            href={isSignup ? "/login" : "/signup"}
            className="font-medium text-accent underline"
          >
            {isSignup ? "Sign in" : "Sign up"}
          </Link>
        </p>
      </div>
    </main>
  );
}
