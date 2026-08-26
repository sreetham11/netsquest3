import { requireUser } from "@/lib/auth";
import { ScanPay } from "./ScanPay";

// Lives outside (app)/ deliberately, not under src/app/(app)/pay — that
// group's layout wraps every page in AppShell's standard header/sidebar,
// but scan_pay/screen.png wants a full-bleed dark scanner view with its own
// back+title+help top bar instead (payment_successful suppresses nav
// entirely for the same reason). Still auth-gated: requireUser() here
// (redundant with the edge middleware, matching every (app)/ page's own
// belt-and-suspenders pattern) and /pay is already in PROTECTED_PREFIXES
// (src/lib/nav.ts, added in the nav-restructure phase).
export default async function PayPage() {
  await requireUser();
  return <ScanPay />;
}
