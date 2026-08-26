import { PreviewNav } from "./PreviewNav";

// Everything under /preview/* is a public, unauthenticated, mock-data
// preview of the redesigned UI — NOT the real app. No page under this tree
// imports src/lib/prisma.ts or src/lib/supabase/* (directly or
// transitively); every "account", "transaction", "reward", etc. below is a
// hardcoded literal. src/proxy.ts excludes this whole path from the auth
// middleware's matcher, so it never touches Supabase either.
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-background">
      <div className="sticky top-0 z-20 bg-primary px-4 py-2 text-center text-label-md font-semibold text-on-primary">
        Preview only — mock data, no real login or persistence
      </div>
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6">{children}</main>
      <PreviewNav />
    </div>
  );
}
