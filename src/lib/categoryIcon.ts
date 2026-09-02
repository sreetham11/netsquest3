import type { IconName } from "@/components/Icon";

// THE single source of truth for spending categories: one entry per category,
// mapping it to its icon. The Budget page's "Set a budget" dropdown is derived
// from this map (see BUDGET_CATEGORIES below) rather than repeating the names,
// so a category can never exist in one list and be missing from the other.
//
// Declaration order IS display order in the dropdown.
//
// NOTE: this is the BUDGET/spend taxonomy. Split has its own unrelated,
// lowercase category set in NewSplitForm.tsx ("food", "cafe", "ride", …) for
// labelling a split — deliberately not merged, it means something different.
const CATEGORY_ICON: Record<string, IconName> = {
  Food: "fast-food",
  Groceries: "grocery",
  Shopping: "voucher", // shopping-bag shape
  Transport: "ride",
  Entertainment: "movie-ticket",
  Utilities: "bills",
  Overseas: "overseas", // globe — foreign-currency spend
};

export function categoryIcon(category: string): IconName {
  return CATEGORY_ICON[category] ?? "budget";
}

// The full set of categories a user can set a budget cap for. DERIVED from
// CATEGORY_ICON so the two can never drift — do not hand-maintain this list.
export const BUDGET_CATEGORIES = Object.keys(CATEGORY_ICON);
