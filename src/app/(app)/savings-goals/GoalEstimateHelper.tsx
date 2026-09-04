"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/lib/format";
import type { ClarifyingQuestion, GoalSpendSuggestion } from "@/lib/savingsGoals";
import { generateGoalClarifyingQuestions, suggestGoalSpendCut } from "../actions";

// Tap-only pill, no typing at any point — same selected/unselected chip
// styling as Split's saved-contact chips (NewSplitForm.tsx toggleContact).
function Pill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
        (selected
          ? "border-accent bg-accent text-white"
          : "border-line bg-surface text-ink hover:bg-surface-muted")
      }
    >
      {selected ? <Icon name="check" size={13} /> : null}
      {label}
    </button>
  );
}

// Drives the "Help me estimate" intake flow: generate 2-3 tap-only
// clarifying questions -> collect pill answers -> one real, informational
// spending-cut suggestion. Mounted only while that flow is active; NewGoalForm
// swaps this in for the plain "Target amount" input and swaps it back out via
// onDone. Not shown at all otherwise — a user typing their own amount never
// triggers or sees this.
//
// Deliberately does NOT compute or offer any number to fill into the target
// amount field. An earlier version asked Claude for a per-goal cost
// breakdown and a "suggested target", which fabricated shopping lists (a
// $200 "Gym Protein Powder" goal came back with whey/casein/shaker
// bottles/flavor packs) and implied the AI's total was more "correct" than
// what the user typed. The user's target amount is authoritative — this
// component only ever surfaces real spending context (via
// suggestGoalSpendCut, which reuses refreshGoalSuggestions' own real-data
// pipeline) for the user to weigh themselves.
export function GoalEstimateHelper({
  goalName,
  currency,
  onDone,
}: {
  goalName: string;
  currency: string;
  onDone: () => void;
}) {
  const [step, setStep] = useState<"loading-questions" | "questions" | "loading-suggestion" | "suggestion" | "error">(
    "loading-questions",
  );
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [suggestion, setSuggestion] = useState<GoalSpendSuggestion | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Next.js App Router runs Strict Mode by default in dev, which mounts
    // this effect, cleans it up, then mounts it again — so this body runs
    // TWICE per real mount, firing two concurrent generateGoalClarifyingQuestions
    // calls whose results race. Without `ignore`, whichever call resolves
    // LAST wins and overwrites state — including a real "questions" step
    // that had already rendered. `ignore` makes only the current
    // (post-cleanup) invocation allowed to touch state; the superseded one's
    // result is discarded when it resolves.
    let ignore = false;
    startTransition(async () => {
      const result = await generateGoalClarifyingQuestions(goalName);
      if (ignore) return;
      if (!result.ok) {
        setErrorMessage(result.error);
        setStep("error");
        return;
      }
      setQuestions(result.questions);
      setStep("questions");
    });
    return () => {
      ignore = true;
    };
    // goalName is fixed for the lifetime of this helper (NewGoalForm remounts
    // it via `key` if the name changes), so this only needs to run per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectAnswer(questionIndex: number, option: string) {
    setAnswers((prev) => ({ ...prev, [questionIndex]: option }));
  }

  function submitAnswers() {
    const built = questions.map((q, i) => ({ question: q.question, answer: answers[i] }));
    setStep("loading-suggestion");
    startTransition(async () => {
      const result = await suggestGoalSpendCut(goalName, built);
      if (!result.ok) {
        setErrorMessage(result.error);
        setStep("error");
        return;
      }
      setSuggestion(result.suggestion);
      setStep("suggestion");
    });
  }

  const allAnswered = questions.length > 0 && questions.every((_, i) => Boolean(answers[i]));

  if (step === "loading-questions" || step === "loading-suggestion") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-button border border-line bg-surface-muted px-4 py-8 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
        <p className="text-sm text-ink-muted">
          {step === "loading-suggestion"
            ? "Checking your real spending for a helpful cut…"
            : "Thinking of a couple of quick questions…"}
        </p>
      </div>
    );
  }

  if (step === "questions") {
    return (
      <div className="flex flex-col gap-4">
        {questions.map((q, i) => (
          <div key={i} className="flex flex-col gap-2">
            <p className="text-sm font-medium text-ink">{q.question}</p>
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => (
                <Pill key={opt} label={opt} selected={answers[i] === opt} onClick={() => selectAnswer(i, opt)} />
              ))}
            </div>
          </div>
        ))}
        <div className="flex flex-col gap-2">
          <Button type="button" onClick={submitAnswers} disabled={!allAnswered || pending} className="w-full justify-center">
            Show me a savings suggestion
          </Button>
          <button type="button" onClick={onDone} className="text-center text-sm text-ink-muted hover:text-ink">
            Enter an amount myself instead
          </button>
        </div>
      </div>
    );
  }

  if (step === "suggestion" && suggestion) {
    return (
      <div className="flex flex-col gap-4">
        {/* The dollar figures here are the REAL numbers already fetched from
            getGoalCoachSpendingStats, and the cut amount is computed in code
            by spendCutCandidates (currentPeriodCents - averageMonthlyCents,
            capped at 50% of currentPeriodCents so a category with barely
            any history can't be suggested down to almost nothing) — not
            restated or invented by Claude. Only the reasoning sentence
            below comes from the model, and only about this same real
            category. */}
        <div className="rounded-button bg-surface-muted px-3 py-2.5 text-sm">
          <p className="text-ink">
            <span className="font-medium">{suggestion.category}:</span>{" "}
            {formatMoney(suggestion.currentPeriodCents, currency)} this month vs your{" "}
            {formatMoney(suggestion.averageMonthlyCents, currency)} average
          </p>
          <p className="mt-1.5 text-ink">
            Cutting{" "}
            <span className="font-semibold">
              {formatMoney(suggestion.suggestedReductionCents, currency)}/mo
            </span>{" "}
            from {suggestion.category} could help fund this goal.
          </p>
          <p className="mt-1 text-xs text-ink-muted">{suggestion.reasoning}</p>
        </div>
        <p className="text-xs text-ink-muted">
          Just context — pick whatever target amount feels right for &quot;{goalName}&quot;.
        </p>
        <Button type="button" onClick={onDone} className="w-full justify-center">
          Got it
        </Button>
      </div>
    );
  }

  // Fail gracefully, same pattern as every other AI feature here: no cascading
  // second AI call, just a clear message and a way back to manual entry.
  return (
    <div className="flex flex-col gap-3 rounded-button border border-line bg-surface-muted px-4 py-4 text-center">
      <p className="text-sm text-ink-muted">{errorMessage || "Couldn't complete this right now."}</p>
      <Button type="button" onClick={onDone} className="w-full justify-center">
        Enter an amount myself
      </Button>
    </div>
  );
}
