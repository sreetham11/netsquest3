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

// Transaction.category (BUDGET_CATEGORIES, capitalized free-form: "Food",
// "Groceries", ...) and the icon-style category vocabulary Split's dropdown
// and MerchantDeal.category both use ("food", "grocery", "cafe", "ride",
// "cinema", "convenience", "pharmacy", ...) are DIFFERENT vocabularies — a
// naive .toLowerCase() only accidentally works for "Food" -> "food". This is
// the one explicit reconciliation between them; some Transaction categories
// (Shopping, Utilities, Other) genuinely have no good icon-category match —
// those return null rather than guessing one. Used by both Split's "start
// from a real transaction" prefill and Rewards' merchant-relevance sort.
const TRANSACTION_TO_ICON_CATEGORY: Record<string, string> = {
  Food: "food",
  Groceries: "grocery",
  Transport: "ride",
  Entertainment: "cinema",
};

export function transactionCategoryToIconCategory(category: string): string | null {
  return TRANSACTION_TO_ICON_CATEGORY[category] ?? null;
}
