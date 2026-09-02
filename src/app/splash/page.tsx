import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SplashScreen } from "./SplashScreen";

// Pre-login entry point. A signed-in visitor skips the onboarding entirely
// and lands on /home, exactly as before — the splash is only for logged-out
// users. No auth logic is changed here; this only reads the existing session.
export default async function SplashPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/home");

  return <SplashScreen />;
}
