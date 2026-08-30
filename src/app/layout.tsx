import type { Metadata } from "next";
import { hankenGrotesk } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "NETS Quest",
  description: "Simulated wallet, splits, and rewards.",
};

// Applies the dark/light class before React hydrates (and before first
// paint) — without this, the page would render in the light-mode tokens for
// one frame and then flip, which is the exact flash-of-wrong-theme this is
// here to prevent. Reads the stored choice; falls back to OS preference on
// a first visit with nothing stored yet. Mirrors src/lib/theme.ts's
// resolveInitialTheme() logic — kept separate (not imported) because this
// has to run as a plain synchronous inline script, not a module.
const NO_FLASH_THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${hankenGrotesk.variable}`}
      // The inline script below mutates this element's class list before
      // React hydrates (that's the entire point — it has to run pre-paint
      // to avoid a flash). React then sees a real DOM/server mismatch on
      // <html>'s className and logs a hydration-mismatch warning by default;
      // suppressHydrationWarning is the documented, scoped escape hatch for
      // exactly this case (it only silences the warning for THIS element's
      // own attributes, not the rest of the tree).
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
