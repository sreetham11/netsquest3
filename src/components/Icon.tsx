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
  | "upload"
  // --- Added for the NETS Revitalize redesign (Stitch screens) -------------
  | "menu"
  | "bell"
  | "profile"
  | "gallery"
  | "flashlight"
  | "qr-code"
  | "check-circle"
  | "settings"
  | "shield"
  | "sliders"
  | "edit-profile"
  | "help-circle"
  | "chevron-right"
  | "chevron-left"
  | "more"
  | "gift"
  | "storefront"
  | "bus"
  | "wallet"
  | "circle-plus"
  | "minus"
  | "card"
  | "moon";

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
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  bell: (
    <>
      <path d="M12 3.5a5 5 0 0 0-5 5v3.2c0 .8-.3 1.6-.8 2.2L5 15.5h14l-1.2-1.6a3.6 3.6 0 0 1-.8-2.2V8.5a5 5 0 0 0-5-5z" />
      <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20.5a7.5 6 0 0 1 15 0" />
    </>
  ),
  gallery: (
    <>
      <path d="M4.5 6.5h13a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" />
      <circle cx="8.5" cy="10.3" r="1.4" />
      <path d="M5 17l4.3-4.3a1.3 1.3 0 0 1 1.9 0l1.6 1.6M13.5 15l1.3-1.3a1.3 1.3 0 0 1 1.9 0L19 16" />
    </>
  ),
  flashlight: (
    <>
      <path d="M9 3h6l1 3-1.5 1.5v10a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-10L8 6l1-3z" />
      <path d="M9.5 11h5" />
    </>
  ),
  "qr-code": (
    <>
      <path d="M4 8V5a1 1 0 0 1 1-1h3" />
      <path d="M20 8V5a1 1 0 0 0-1-1h-3" />
      <path d="M4 16v3a1 1 0 0 0 1 1h3" />
      <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
      <rect x="10" y="10" width="4" height="4" rx=".6" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3l2.4 2.4 4.9-5.1" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.7 6.3l-1.6 1.6M7.9 16.1l-1.6 1.6M17.7 17.7l-1.6-1.6M7.9 7.9 6.3 6.3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5l7 2.5v5.5c0 5-3 8-7 9.5-4-1.5-7-4.5-7-9.5V6l7-2.5z" />
      <path d="M9 12l2 2 4-4.2" />
    </>
  ),
  sliders: (
    <>
      <path d="M6 4v6M6 14v6M12 4v11M12 19v1M18 4v3M18 11v9" />
      <circle cx="6" cy="11" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18" cy="8" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  "edit-profile": (
    <>
      <path d="M14.5 4.5l5 5L8 21l-5.5 1L4 16.5 14.5 4.5z" />
      <path d="M13 6l5 5" />
    </>
  ),
  "help-circle": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.3a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .8-1 1.6v.3" />
      <circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  "chevron-right": <path d="M9 5l7 7-7 7" />,
  "chevron-left": <path d="M15 5l-7 7 7 7" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  gift: (
    <>
      <path d="M4.5 9.5h15v3h-15z" />
      <path d="M5.5 12.5h13v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7z" />
      <path d="M12 9.5v11" />
      <path d="M12 9.5c-.8-2.8-3-3.8-4.2-2.7-1 .9-.2 2.7 1.8 2.7h2.4zM12 9.5c.8-2.8 3-3.8 4.2-2.7 1 .9.2 2.7-1.8 2.7H12z" />
    </>
  ),
  storefront: (
    <>
      <path d="M4 9.5L5.5 4h13L20 9.5" />
      <path d="M4.5 9.5v9.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 20V14a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6" />
    </>
  ),
  bus: (
    <>
      <path d="M4.5 6.5A1.5 1.5 0 0 1 6 5h12a1.5 1.5 0 0 1 1.5 1.5v9.5H4.5V6.5z" />
      <path d="M4.5 11h15" />
      <path d="M7.5 8.2h3M13.5 8.2h3" />
      <circle cx="7.5" cy="17.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="17.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h11A1.5 1.5 0 0 1 18 7.5V9h1a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 19H5.5A1.5 1.5 0 0 1 4 17.5v-10z" />
      <circle cx="15.7" cy="13.3" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  "circle-plus": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.2v7.6M8.2 12h7.6" />
    </>
  ),
  minus: <path d="M6 12h12" />,
  card: (
    <>
      <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-11z" />
      <path d="M3.5 9.5h17" />
      <path d="M6.5 14h4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
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
