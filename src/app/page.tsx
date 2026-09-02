import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Entry point. Signed in -> straight into the app, exactly as before.
// Signed out -> the pre-login onboarding flow (/splash -> /welcome -> /login).
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/home" : "/splash");
}
