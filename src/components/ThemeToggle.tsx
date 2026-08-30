"use client";

import { useSyncExternalStore } from "react";
import { Switch } from "@/components/ui/Switch";
import { isDarkActive, getServerTheme, setTheme, subscribeTheme } from "@/lib/theme";

// useSyncExternalStore, not useState+useEffect: the .dark class is external
// DOM state (set by layout.tsx's pre-hydration script, and by setTheme()
// here), not component state — this is exactly the case that hook exists
// for, and it reconciles server/client without a hydration-mismatch flash
// or an extra setState-triggered render on mount.
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, isDarkActive, getServerTheme);

  return (
    <Switch
      checked={dark}
      onChange={(checked) => setTheme(checked ? "dark" : "light")}
      label="Toggle dark mode"
    />
  );
}
