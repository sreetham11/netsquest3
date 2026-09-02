// Spin to Decide — payer of record only.
//
// One spin, one outcome: who FRONTS the bill. The base equal/custom split is
// computed by createSplit and is NEVER recalculated by a spin; "owes payer" is
// derived from the existing shareAmountCents, so no money is duplicated and no
// participant ever absorbs 100% of the bill.

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
