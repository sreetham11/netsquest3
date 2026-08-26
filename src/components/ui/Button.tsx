import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// CTA button. Primary blue is the ONLY interactive/CTA color — red (secondary)
// is reserved for the logo and alerts, never a button, per DESIGN.md.
type Variant = "primary" | "secondary";

// min-h-12 (48px) satisfies DESIGN.md's "Touch Targets: minimum height of
// 48px" regardless of content/padding.
const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-6 text-body-lg font-semibold transition-colors disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-nets-blue-gradient-start",
  secondary: "border border-primary bg-transparent text-primary hover:bg-primary/5",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: {
  variant?: Variant;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
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
