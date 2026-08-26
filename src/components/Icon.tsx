import type { SVGProps } from "react";

// Minimal 24x24 stroke icons (currentColor). No emoji anywhere per design rules.
export type IconName =
  | "home"
  | "transactions"
  | "split"
  | "check"
  | "rewards"
  | "overseas"
  | "bills"
  | "budget"
  | "plus"
  | "arrow-up"
  | "arrow-down"
  | "logout"
  | "coffee"
  | "bubble-tea"
  | "fast-food"
  | "movie-ticket"
  | "voucher"
  | "grocery"
  | "convenience"
  | "ride"
  | "pharmacy"
  | "pin"
  | "contactless"
  | "camera"
  | "upload";

const paths: Record<IconName, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />,
  transactions: (
    <>
      <path d="M4 7h11M4 7l3-3M4 7l3 3" />
      <path d="M20 17H9M20 17l-3-3M20 17l-3 3" />
    </>
  ),
  split: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18" strokeDasharray="2.2 2.2" />
    </>
  ),
  check: <path d="M5 13l4 4L19 7" />,
  rewards: (
    <>
      <path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.2l5.4-.8L12 3.5z" />
    </>
  ),
  overseas: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3z" />
    </>
  ),
  bills: (
    <>
      <path d="M6 3h12v18l-3-1.8L12 21l-3-1.8L6 21V3z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  budget: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l3-4 3 2 4-6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  "arrow-up": <path d="M12 19V5M6 11l6-6 6 6" />,
  "arrow-down": <path d="M12 5v14M6 13l6 6 6-6" />,
  logout: (
    <>
      <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
      <path d="M10 8l-4 4 4 4M6 12h11" />
    </>
  ),
  coffee: (
    <>
      <path d="M5 9h11v5.5A4.5 4.5 0 0 1 11.5 19H9.5A4.5 4.5 0 0 1 5 14.5V9z" />
      <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8 5.2c0-1 1-1 1-2M12 5.2c0-1 1-1 1-2" />
    </>
  ),
  "bubble-tea": (
    <>
      <path d="M13 3v3.2" />
      <path d="M6.3 8h11.4l-.7-2.3a1 1 0 0 0-1-.7H8a1 1 0 0 0-1 .7L6.3 8z" />
      <path d="M6.3 8h11.4L16.8 19a2 2 0 0 1-2 1.8h-3.6a2 2 0 0 1-2-1.8L6.3 8z" />
      <circle cx="10.2" cy="13.5" r=".6" fill="currentColor" stroke="none" />
      <circle cx="13.4" cy="15" r=".6" fill="currentColor" stroke="none" />
      <circle cx="10.6" cy="16.5" r=".6" fill="currentColor" stroke="none" />
    </>
  ),
  "fast-food": (
    <>
      <path d="M4.5 10.5a7.5 5 0 0 1 15 0z" />
      <path d="M4 10.5h16M4 14h16" />
      <path d="M3.5 14a1.5 1.5 0 0 0 1.5 3h14a1.5 1.5 0 0 0 1.5-3" />
    </>
  ),
  "movie-ticket": (
    <>
      <path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.3a1.4 1.4 0 0 0 0 2.8V15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.9a1.4 1.4 0 0 0 0-2.8V9z" />
      <path d="M9.5 7.3v9.4" strokeDasharray="2 2" />
    </>
  ),
  voucher: (
    <>
      <path d="M6.5 8h11l-1 11a1.5 1.5 0 0 1-1.5 1.3H9a1.5 1.5 0 0 1-1.5-1.3L6.5 8z" />
      <path d="M9.5 8V6a2.5 2.5 0 0 1 5 0v2" />
    </>
  ),
  grocery: (
    <>
      <path d="M4.5 9h15l-1.6 9.3a1.5 1.5 0 0 1-1.5 1.2H7.6a1.5 1.5 0 0 1-1.5-1.2L4.5 9z" />
      <path d="M8 9l1.5-4M16 9l-1.5-4" />
      <path d="M9.5 12.5v4M14.5 12.5v4" />
    </>
  ),
  convenience: (
    <>
      <path d="M4.5 10.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-8.5" />
      <path d="M3.5 6.5h17l.8 3.3a1.8 1.8 0 0 1-3.5.8 1.8 1.8 0 0 1-3.5 0 1.8 1.8 0 0 1-3.6 0 1.8 1.8 0 0 1-3.5 0 1.8 1.8 0 0 1-3.5-.8l.8-3.3z" />
      <path d="M10 20v-4.5h4V20" />
    </>
  ),
  ride: (
    <>
      <path d="M3.5 15.5l1.5-5A2 2 0 0 1 6.9 9h10.2a2 2 0 0 1 1.9 1.5l1.5 5" />
      <path d="M3 15.5h18v3a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-.5H6v.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3z" />
      <circle cx="7" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="17" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  pharmacy: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.5-7-11.5A7 7 0 0 1 19 9.5C19 14.5 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </>
  ),
  contactless: (
    <>
      <circle cx="7" cy="17" r="1" fill="currentColor" stroke="none" />
      <path d="M10 14a5.7 5.7 0 0 1 0 6" />
      <path d="M13 11.5a9.3 9.3 0 0 1 0 11" />
      <path d="M16 9a13 13 0 0 1 0 12" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4M8 8l4-4 4 4" />
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  ...props
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
