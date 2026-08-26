import { Hanken_Grotesk } from "next/font/google";

// Self-hosted (next/font/google downloads + serves at build time, no runtime
// request to Google) — see globals.css's --font-sans, which references this
// variable with the old system-font stack kept as fallback.
export const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken-grotesk",
  display: "swap",
});
