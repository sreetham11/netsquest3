// Spin to Decide — payer of record only.
//
// One spin, one outcome: who FRONTS the bill. The base equal/custom split is
// computed by createSplit and is NEVER recalculated by a spin; "owes payer" is
// derived from the existing shareAmountCents, so no money is duplicated and no
// participant ever absorbs 100% of the bill.

// Participants are names only (no linked accounts, see getSplits) — this is
// the name that stands in for the account holder within that list, both as
// the default first participant and, after a spin, when checking whether the
// current user is the resolved payer.
export const YOU_PARTICIPANT_NAME = "You";

export type SpinParticipant = {
  id: string;
  name: string;
  shareAmountCents: number;
};

export type SpinSplit = {
  payerParticipantId: string | null;
  spunAt: Date | null;
};

export function alreadySpun(split: SpinSplit): boolean {
  return split.spunAt !== null;
}

// A split may be spun exactly once, and only if there is someone to pick.
export function canSpin(split: SpinSplit, participants: SpinParticipant[]): boolean {
  return !alreadySpun(split) && participants.length > 0;
}

export function payerOf(
  split: SpinSplit,
  participants: SpinParticipant[],
): SpinParticipant | null {
  if (!split.payerParticipantId) return null;
  return participants.find((p) => p.id === split.payerParticipantId) ?? null;
}

// Bridges the Budget/transaction category taxonomy (categoryIcon.ts — "Food",
// "Transport", ...) to Split's own separate, lowercase taxonomy (NewSplitForm
// — "food", "ride", ..., "General"). The two are deliberately not merged (see
// categoryIcon.ts), so a transaction's category needs mapping, not passing
// through, when it pre-fills a split. Unmapped categories fall back to
// "General" rather than a value NewSplitForm's <select> wouldn't recognize.
const BUDGET_TO_SPLIT_CATEGORY: Record<string, string> = {
  Food: "food",
  Groceries: "grocery",
  Transport: "ride",
};

export function budgetCategoryToSplitCategory(category: string): string {
  return BUDGET_TO_SPLIT_CATEGORY[category] ?? "General";
}
