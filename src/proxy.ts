import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals, static assets, and the
    // mock-data /preview/* tree — excluded here (not just left off
    // PROTECTED_PREFIXES) so this function never even invokes for those
    // paths. updateSession() calls supabase.auth.getUser() unconditionally
    // before it checks whether a route is protected, so being absent from
    // PROTECTED_PREFIXES alone wouldn't stop it from touching Supabase —
    // only being outside this matcher does.
    "/((?!_next/static|_next/image|favicon.ico|preview|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
