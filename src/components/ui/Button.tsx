import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// CTA button. Blue is the ONLY interactive/CTA color, so there is deliberately
// no red/danger variant here.
type Variant = "primary" | "secondary";

const base =
  "inline-flex items-center justify-center gap-2 rounded-button px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-muted",
};

// Same ring-spinner shape used everywhere else a loading state needs one
// (originally NewSplitForm's receipt-scan step) — centralized here so every
// pending action button gets it consistently instead of a text-only label
// change. Ring color adapts to the button's own background: white-tinted on
// a filled blue "primary" button, blue-tinted (the established pattern) on
// a white/bordered "secondary" one.
const SPINNER_RING: Record<Variant, string> = {
  primary: "border-white/40 border-t-white",
  secondary: "border-line border-t-accent",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  loading = false,
  disabled,
  ...props
}: {
  variant?: Variant;
  children: ReactNode;
  // Shows a small spinner and disables the button — pass the same `pending`
  // boolean already driving the label text, so loading state is visual as
  // well as textual.
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden
          className={`h-3.5 w-3.5 animate-spin rounded-full border-2 ${SPINNER_RING[variant]}`}
        />
      ) : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}
