import { redirect } from "next/navigation";

// Root simply routes into the app; the proxy bounces to /login if signed out.
export default function RootPage() {
  redirect("/home");
}
