// Savings Goals — pure math only. No AI, no network, no Prisma. The one AI
// call left in this feature (see explainSpendCuts in src/app/(app)/actions.ts)
// only ever writes a `reasoning` sentence onto numbers already computed here
// or in src/lib/data/queries.ts — it is never asked for, and never allowed to
// override, a dollar amount, a date, or a category selection.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type RequiredSavings = {
  remainingCents: number;
  // Whole days/weeks/months, rounded UP — better to ask for slightly more per
  // period than to understate what's actually needed to hit the date.
  daysRemaining: number;
  weeksRemaining: number;
  monthsRemaining: number;
  weeklyCents: number;
  monthlyCents: number;
};

// (targetAmountCents - currentSavedCents) / time-until-targetDate, exactly as
// specified — the only wrinkles are floors so a past-due or same-day target
// doesn't divide by zero or go negative. Always derived from the real current
// date and the goal's real target date — nothing here is hardcoded.
export function requiredMonthlySavings(goal: {
  targetAmountCents: number;
  currentSavedCents: number;
  targetDate: Date;
  now?: Date;
}): RequiredSavings {
  const now = goal.now ?? new Date();
  const remainingCents = Math.max(0, goal.targetAmountCents - goal.currentSavedCents);
  const daysRemaining = Math.max(1, Math.ceil((goal.targetDate.getTime() - now.getTime()) / MS_PER_DAY));
  const weeksRemaining = Math.max(1, Math.ceil(daysRemaining / 7));
  const monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30));
  const weeklyCents = remainingCents > 0 ? Math.ceil(remainingCents / weeksRemaining) : 0;
  const monthlyCents = remainingCents > 0 ? Math.ceil(remainingCents / monthsRemaining) : 0;
  return { remainingCents, daysRemaining, weeksRemaining, monthsRemaining, weeklyCents, monthlyCents };
}

// There's no deposit history on SavingsGoal (currentSavedCents is a single
// number the user overwrites, not a ledger — see updateSavingsGoalProgress),
// so "actual pace this month" can't be read back from real per-month
// contributions. The closest honest stand-in computable from what's actually
// stored is the average pace maintained since the goal was created: total
// saved so far / months elapsed since createdAt. A goal still in its first
// (partial) month is floored to 1 month, same convention
// requiredMonthlySavings uses for monthsRemaining — otherwise a goal a few
// days old would show an inflated, misleading pace.
export function actualMonthlyPace(goal: { currentSavedCents: number; createdAt: Date; now?: Date }): number {
  const now = goal.now ?? new Date();
  const daysElapsed = Math.max(0, (now.getTime() - goal.createdAt.getTime()) / MS_PER_DAY);
  const monthsElapsed = Math.max(1, daysElapsed / 30);
  return Math.round(goal.currentSavedCents / monthsElapsed);
}

// How many fewer days it would take to close the remaining gap if the user's
// saving pace went up by extraMonthlyCents/month, starting from whichever
// pace is more meaningful right now: their real historical pace once they
// have one (actualMonthlyPace > 0), or — for a goal too new to have a real
// pace yet — the pace the goal itself requires. Capped at daysRemaining: a
// cut can never be credited with pulling the date in by more than the whole
// remaining timeline. Entirely deterministic — never asked of or overridden
// by the AI call in actions.ts.
export function estimateDaysSooner(
  goal: {
    targetAmountCents: number;
    currentSavedCents: number;
    targetDate: Date;
    createdAt: Date;
    now?: Date;
  },
  extraMonthlyCents: number,
): number {
  const required = requiredMonthlySavings(goal);
  if (required.remainingCents <= 0 || extraMonthlyCents <= 0) return 0;

  const actualPace = actualMonthlyPace(goal);
  const basePaceCents = actualPace > 0 ? actualPace : required.monthlyCents;
  if (basePaceCents <= 0) return 0;

  const daysAtBase = (required.remainingCents / basePaceCents) * 30;
  const daysAtImproved = (required.remainingCents / (basePaceCents + extraMonthlyCents)) * 30;
  const raw = Math.round(daysAtBase - daysAtImproved);
  return Math.max(0, Math.min(raw, required.daysRemaining));
}

// --- AI Goal Coach ----------------------------------------------------------
// Two display modes, never a chat/free-text box:
//
// - "general": not enough real transaction history to say anything
//   personalized yet. Entirely code-generated — the pace figures come from
//   requiredMonthlySavings above, and the tips are a fixed, generic list
//   below. No AI call is made for this mode at all, so there is nothing here
//   for a model to invent.
// - "personalized": there IS enough history. Candidate categories and their
//   suggested reduction (currentPeriodCents - averageMonthlyCents, both real
//   numbers from src/lib/data/queries.ts) are chosen entirely in code by
//   spendCutCandidates below; the AI call in actions.ts only ever fills in
//   `reasoning` for a category it was already told about — it cannot select
//   categories, cannot invent a category, and is never asked for a dollar
//   figure. Never reverse-engineered to sum to the goal's remaining amount.
// - "no-candidates": enough history exists, but nothing is meaningfully over
//   its average right now — shown as-is rather than inventing a suggestion
//   to fill the gap.
//
// Persisted as JSON-serialized TEXT (aiSuggestions column) — same rationale
// as before: this is the only structured-JSON-shaped field in the schema, so
// a stringified column keeps the generated Prisma types simple.

export const GENERAL_SAVING_TIPS: readonly string[] = [
  "Set aside $10 from your next 5 purchases instead of spending it.",
  "Round up each purchase to the nearest dollar and save the difference.",
  "Skip one takeout or delivery order this week and put it toward this goal instead.",
];

export type CategorySpendStat = {
  category: string;
  currentPeriodCents: number;
  averageMonthlyCents: number;
};

export type SpendingHistorySummary = {
  hasEnoughHistory: boolean;
  categories: CategorySpendStat[];
};

export type SpendCutCandidate = CategorySpendStat & {
  suggestedReductionCents: number;
};

// Filters out noise ($5 floor) and anything not actually above its own
// average, then ranks by size of the real overspend. Pure function of the
// stats already computed in queries.ts — the AI never sees this decision,
// only the categories it already produced.
const MIN_SUGGESTED_REDUCTION_CENTS = 500;

// Sanity cap: the raw "current - average" delta can be almost the entire
// category (a category with barely any spend history has a tiny average, so
// a single unusually large month reads as a huge "overspend" — e.g. $1,179
// this month vs a $40.15 average suggested cutting $1,138.85, wiping out 96%
// of the category). Capping at 50% of current-month spend keeps every
// suggestion realistic — "cut this category in half," never "cut it to
// almost nothing" — regardless of how low the historical average is. This
// is the number that then flows into the category's `why` prompt/reasoning
// AND into estimateDaysSooner below, so the badge, the AI's prose, and the
// goal-impact figure never disagree with each other.
const MAX_REDUCTION_FRACTION_OF_CURRENT = 0.5;

export function spendCutCandidates(categories: CategorySpendStat[], max = 3): SpendCutCandidate[] {
  return categories
    .filter((c) => c.averageMonthlyCents > 0 && c.currentPeriodCents > c.averageMonthlyCents)
    .map((c) => {
      const rawReductionCents = c.currentPeriodCents - c.averageMonthlyCents;
      const capCents = Math.floor(c.currentPeriodCents * MAX_REDUCTION_FRACTION_OF_CURRENT);
      return { ...c, suggestedReductionCents: Math.min(rawReductionCents, capCents) };
    })
    .filter((c) => c.suggestedReductionCents >= MIN_SUGGESTED_REDUCTION_CENTS)
    .sort((a, b) => b.suggestedReductionCents - a.suggestedReductionCents)
    .slice(0, max);
}

export type GoalSuggestion = SpendCutCandidate & {
  // Code-computed via estimateDaysSooner — never asked of the model.
  daysSooner: number;
  // The only AI-sourced field in this whole type.
  reasoning: string;
};

export type GoalCoachResult =
  | { mode: "general"; remainingCents: number; weeklyCents: number; monthlyCents: number; tips: string[] }
  | { mode: "personalized"; suggestions: GoalSuggestion[] }
  | { mode: "no-candidates" };

export function parseGoalCoachResult(raw: string | null): GoalCoachResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.mode === "general" || parsed?.mode === "personalized" || parsed?.mode === "no-candidates") {
      return parsed as GoalCoachResult;
    }
    return null;
  } catch {
    return null;
  }
}

// --- "Help me estimate" intake flow -----------------------------------------
// Two on-demand Claude calls (same forced-tool-use/fail-gracefully family as
// the AI Goal Coach above), used only while the New Goal form is open — never
// persisted. Step 1 asks 2-3 tap-only clarifying questions. Step 2 does NOT
// generate a cost estimate or a suggested target amount — an earlier version
// did, by asking Claude to invent a per-goal cost breakdown, and it
// fabricated shopping lists (a $200 "Gym Protein Powder" goal came back as
// whey + casein + shaker bottles + flavor packs). The user's target amount
// is authoritative; nothing here computes a replacement for it. Step 2 now
// only surfaces one real, evidence-based spending-cut suggestion — same
// spendCutCandidates/explainSpendCuts pipeline as the AI Goal Coach, just
// asked for a single candidate ahead of goal creation.

// Always appended in code, never asked of the model — a guaranteed, uniform
// bailout on every question regardless of what Claude generates.
export const NOT_SURE_OPTION = "I'm not sure";

export type ClarifyingQuestion = {
  question: string;
  // 3-4 model-generated options, plus NOT_SURE_OPTION already appended.
  options: string[];
};

export type ClarifyingAnswer = {
  question: string;
  answer: string;
};

// Purely informational — displayed alongside the New Goal form, never fed
// back into the target amount field. currentPeriodCents/averageMonthlyCents
// are the REAL numbers from getGoalCoachSpendingStats (computed in code, not
// stated by the model); only reasoning comes from Claude, and only ever
// about a category name taken from that same real data.
export type GoalSpendSuggestion = SpendCutCandidate & {
  reasoning: string;
};
