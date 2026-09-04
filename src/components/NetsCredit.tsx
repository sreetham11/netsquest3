import Image from "next/image";

// The REAL NETS brand mark (public/nets-logo.png, provided as-is by
// product — transparent background, red/blue two-tone wordmark). This is
// deliberately its own small, separate element — NEVER merged into
// CompassMark or the "NETS Quest"/"QUEST" text, which are this app's own
// designed identity, not the real company's logo. Keeping the two visually
// distinct (and this one small/secondary) is what makes the "built on
// NETS" credit honest rather than implying NETS Quest IS the real NETS app.
//
// Rendered via next/image at its native 627x163 aspect ratio — width is the
// only dimension callers set, height follows automatically, and the image
// itself is never recolored/stretched/rotated.
export function NetsCredit({
  label = "Powered by",
  width = 130,
  tone = "muted",
  className = "",
  priority = false,
}: {
  label?: string;
  // Logo render width in px — kept in the ~120-160px "small credit" range
  // by every caller; a prop only so it can flex slightly per layout, not an
  // invitation to size it up into a primary mark.
  width?: number;
  // "muted": light/neutral surfaces (Welcome, Profile) — text-ink-muted.
  // "on-dark": the navy hero/photo backgrounds (Splash, the auth screens).
  tone?: "muted" | "on-dark";
  className?: string;
  // Only for a screen sparse enough that this small logo ends up being the
  // Largest Contentful Paint element (e.g. Splash) — next/image flags that
  // case and asks for eager loading.
  priority?: boolean;
}) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {label ? (
        <span
          className={
            "text-xs font-medium " +
            (tone === "on-dark" ? "text-white/70" : "text-ink-muted")
          }
        >
          {label}
        </span>
      ) : null}
      <Image
        src="/nets-logo.png"
        alt="NETS"
        width={627}
        height={163}
        priority={priority}
        className="h-auto"
        style={{ width }}
      />
    </div>
  );
}
