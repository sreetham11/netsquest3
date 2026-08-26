import type { IconName } from "@/components/Icon";

// Shared category -> icon mapping (Budget, Home). Falls back to the generic
// "budget" glyph for any category without a dedicated icon.
const CATEGORY_ICON: Record<string, IconName> = {
  Food: "fast-food",
  Transport: "ride",
  Shopping: "voucher", // shopping-bag shape
  Groceries: "grocery",
  Entertainment: "movie-ticket",
  Utilities: "bills",
};

export function categoryIcon(category: string): IconName {
  return CATEGORY_ICON[category] ?? "budget";
}

// The full set of categories a user can set a budget cap for (Budget page's
// add/edit form). Anything already covered by CATEGORY_ICON plus a generic
// "Other" catch-all — matches the categories seeded/used elsewhere in the app.
export const BUDGET_CATEGORIES = [
  "Food",
  "Groceries",
  "Shopping",
  "Transport",
  "Entertainment",
  "Utilities",
  "Other",
];
