import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Returns the authenticated Supabase user, or redirects to /login.
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}
