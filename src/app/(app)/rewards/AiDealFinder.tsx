"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Icon } from "@/components/Icon";
import { PaymentConfirmCard } from "@/components/payment/PaymentConfirmCard";
import { PaymentSuccessCard } from "@/components/payment/PaymentSuccessCard";
import { formatMoney } from "@/lib/format";
import { randomTransactionRef } from "@/lib/payment";
import type { ClarifyTurn, RankedDeal } from "@/lib/dealFinder";
import { analyzeSearchIntent, findDeals, makePayment } from "../actions";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Minimum time each pipeline stage stays visible, purely for readability —
// NOT a claim about real per-stage timing. findDeals is ONE atomic Server
// Action call (Planning -> Researching -> Scoring happen in a straight line
// inside it, see actions.ts); the client has no way to know when Exa
// finishes and Claude starts mid-call. So "Researching" and "Scoring" are
// shown for at least these floors before advancing, composed with a real,
// uncapped await on the actual request — if the real call is slower than
// these floors (the common case), the stage simply stays up until it
// resolves; the total wait is never hidden or shortened, only ever padded
// up to a readable minimum when the real call happens to be very fast.
const PLANNING_MS = 500;
const RESEARCHING_MIN_MS = 1200;
const SCORING_MIN_MS = 900;

type Stage = "idle" | "understanding" | "clarifying" | "planning" | "researching" | "scoring" | "done" | "error";

const STAGE_ORDER: Stage[] = ["planning", "researching", "scoring", "done"];

const STAGE_INFO: Record<
  Exclude<Stage, "idle" | "understanding" | "clarifying" | "error">,
  { label: string; description: string; tag: string | null }
> = {
  planning: {
    label: "Planning",
    description: "Parsing your search and constraints — deterministic, no API call.",
    tag: null,
  },
  researching: {
    label: "Researching",
    description: "Live web search for real results.",
    tag: "exa · exa-neural",
  },
  scoring: {
    label: "Scoring",
    description: "Ranking results against your priorities.",
    tag: "claude",
  },
  done: {
    label: "Done",
    description: "Results ready.",
    tag: null,
  },
};

type PendingQuestion = { question: string; quickReplies: string[] };

// One line of the mini-clarification chat. Visual-only avatar bubbles — this
// exists purely to resolve ambiguity before searching, never a general
// chatbot: it always terminates in a normal search, never a free-standing
// conversation.
function ChatMessage({ role, children }: { role: "assistant" | "user"; children: React.ReactNode }) {
  const isAssistant = role === "assistant";
  return (
    <div className={"flex items-start gap-2" + (isAssistant ? "" : " flex-row-reverse")}>
      {isAssistant ? (
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-white">
          <Icon name="search" size={12} />
        </div>
      ) : null}
      <div
        className={
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm " +
          (isAssistant ? "rounded-tl-sm bg-surface-muted text-ink" : "rounded-tr-sm bg-accent text-white")
        }
      >
        {children}
      </div>
    </div>
  );
}

// Discovery/recommendation only — this never books, pays for, or checks out
// anything on a real external site. "Authorise & Pay with NETS" resolves
// entirely inside our own simulated wallet via the SAME makePayment Server
// Action Scan & Pay uses (no second/duplicated payment implementation), and
// the confirm/success screens are the SAME shared components Scan & Pay
// uses (src/components/payment/*), not a new payment UI.
export function AiDealFinder({
  balanceCents,
  currency,
}: {
  balanceCents: number;
  currency: string;
}) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [maxBudget, setMaxBudget] = useState("");

  const [stage, setStage] = useState<Stage>("idle");
  const [results, setResults] = useState<RankedDeal[] | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  // Mini-clarification chat state — resolved turns plus the current
  // outstanding question, if any. Reset at the start of every fresh search.
  const [turns, setTurns] = useState<ClarifyTurn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const [freeText, setFreeText] = useState("");

  // Checkout — a single selected result at a time, mirroring PayForm's
  // one-view-at-a-time step model.
  const [checkoutDeal, setCheckoutDeal] = useState<RankedDeal | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<"confirm" | "success">("confirm");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutPending, startCheckoutTransition] = useTransition();
  const [paymentPointsEarned, setPaymentPointsEarned] = useState(0);
  const [successAt, setSuccessAt] = useState<Date | null>(null);
  const [txnRef, setTxnRef] = useState("");

  const maxBudgetCents = maxBudget.trim() ? Math.round(Number(maxBudget) * 100) : null;

  // The one real search call — Planning/Researching/Scoring all happen
  // server-side inside findDeals. Only reached once analyzeSearchIntent says
  // there's nothing critical left unknown.
  async function runFullSearch(resolvedTurns: ClarifyTurn[]) {
    setPendingQuestion(null);
    setStage("planning");
    await sleep(PLANNING_MS);
    setStage("researching");

    const resultPromise = findDeals(query, resolvedTurns, { maxBudgetCents });

    await sleep(RESEARCHING_MIN_MS);
    setStage("scoring");
    await sleep(SCORING_MIN_MS);

    const result = await resultPromise;
    if (!result.ok) {
      setStage("error");
      setError(result.error);
      return;
    }
    setStage("done");
    setResults(result.results);
  }

  // Checks whether there's enough information to search yet. If not, shows
  // the next clarifying question; if so, proceeds straight into the normal
  // search pipeline. Called once on submit, then again after every answer —
  // each call re-parses the FULL conversation so far, so one free-text reply
  // covering several details at once resolves them all in a single round.
  async function checkIntent(resolvedTurns: ClarifyTurn[]) {
    // Clear any prior question immediately — otherwise the stale question
    // (already answered, now part of `turns`) would flash a second time
    // while this call is in flight.
    setPendingQuestion(null);
    setStage("understanding");
    const result = await analyzeSearchIntent(query, resolvedTurns);
    if (!result.ok) {
      setStage("error");
      setError(result.error);
      return;
    }
    if (result.intent.readyToSearch || !result.intent.clarifyingQuestion) {
      await runFullSearch(resolvedTurns);
      return;
    }
    setStage("clarifying");
    setPendingQuestion({
      question: result.intent.clarifyingQuestion,
      quickReplies: result.intent.quickReplies,
    });
  }

  function runSearch() {
    if (pending || !query.trim()) return;
    setError("");
    setResults(null);
    setTurns([]);
    setPendingQuestion(null);
    startTransition(() => checkIntent([]));
  }

  function submitAnswer(answer: string) {
    if (!pendingQuestion || pending || !answer.trim()) return;
    const nextTurns = [...turns, { question: pendingQuestion.question, answer: answer.trim() }];
    setTurns(nextTurns);
    setFreeText("");
    startTransition(() => checkIntent(nextTurns));
  }

  function openCheckout(deal: RankedDeal) {
    setCheckoutDeal(deal);
    setCheckoutStep("confirm");
    setCheckoutError("");
  }

  function closeCheckout() {
    setCheckoutDeal(null);
    setCheckoutStep("confirm");
    setCheckoutError("");
  }

  function confirmCheckout() {
    if (!checkoutDeal || checkoutDeal.priceCents == null || checkoutPending) return;
    setCheckoutError("");
    const formData = new FormData();
    formData.append("merchant", checkoutDeal.title);
    formData.append("category", "Shopping");
    formData.append("amount", String(checkoutDeal.priceCents / 100));

    startCheckoutTransition(async () => {
      // The exact same Server Action Scan & Pay and Bills use — debits
      // balance, awards points via the existing tier formula, writes a real
      // Transaction row. No duplicated payment logic.
      const state = await makePayment(null, formData);
      if (!state?.ok) {
        setCheckoutError(state?.error ?? "Couldn't complete this payment. Try again.");
        return;
      }
      setPaymentPointsEarned(state.pointsEarned);
      setSuccessAt(new Date());
      setTxnRef(randomTransactionRef());
      setCheckoutStep("success");
    });
  }

  if (checkoutDeal) {
    if (checkoutStep === "success" && successAt) {
      return (
        <div className="mb-6">
          <PaymentSuccessCard
            merchant={checkoutDeal.title}
            amountCents={checkoutDeal.priceCents ?? 0}
            currency={currency}
            successAt={successAt}
            txnRef={txnRef}
            pointsEarned={paymentPointsEarned}
            onAgain={closeCheckout}
            againLabel="Back to results"
          />
        </div>
      );
    }
    return (
      <div className="mb-6">
        <PaymentConfirmCard
          payTo={checkoutDeal.title}
          amountCents={checkoutDeal.priceCents ?? 0}
          balanceCents={balanceCents}
          currency={currency}
          pending={checkoutPending}
          error={checkoutError}
          onConfirm={confirmCheckout}
          onCancel={closeCheckout}
          confirmLabel="Authorise & Pay"
          cancelLabel="Back to results"
        />
      </div>
    );
  }

  const inPipeline = STAGE_ORDER.includes(stage);
  const currentIndex = STAGE_ORDER.indexOf(stage);

  return (
    <Card className="mb-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white">
          <Icon name="search" size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">AI Deal Finder</p>
          <p className="text-xs text-ink-muted">Live search, AI-ranked — you decide what to pay for.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">What are you looking for?</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
            placeholder="e.g. flights to Tokyo in December"
            disabled={pending}
            maxLength={200}
            className="rounded-button border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:opacity-60"
          />
        </label>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="w-fit text-xs font-medium text-accent hover:text-accent-strong"
        >
          {showFilters ? "Hide filters" : "Filters (budget)"}
        </button>

        {showFilters ? (
          <div className="flex flex-col gap-3 rounded-button border border-line bg-surface-muted p-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink">Max budget (optional)</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(e.target.value)}
                  placeholder="No limit"
                  disabled={pending}
                  className="w-full rounded-button border border-line bg-surface py-1.5 pl-6 pr-2 text-sm text-ink outline-none focus:border-accent disabled:opacity-60"
                />
              </div>
            </label>
          </div>
        ) : null}

        <Button
          type="button"
          onClick={runSearch}
          disabled={pending || !query.trim()}
          className="w-full justify-center"
        >
          {pending ? "Searching…" : "Find deals"}
        </Button>
      </div>

      {/* Mini-chat clarification area — visible once a question has been
          asked or answered. Not a general chatbot: it only ever exists to
          resolve missing critical info, then hands off into the normal
          results flow below. */}
      {turns.length > 0 || pendingQuestion ? (
        <div className="mt-4 flex flex-col gap-3 rounded-button border border-line bg-surface p-3">
          {turns.map((t, i) => (
            <div key={i} className="flex flex-col gap-2">
              <ChatMessage role="assistant">{t.question}</ChatMessage>
              <ChatMessage role="user">{t.answer}</ChatMessage>
            </div>
          ))}

          {pendingQuestion ? (
            <div className="flex flex-col gap-2">
              <ChatMessage role="assistant">{pendingQuestion.question}</ChatMessage>
              {pendingQuestion.quickReplies.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pl-8">
                  {pendingQuestion.quickReplies.map((reply) => (
                    <button
                      key={reply}
                      type="button"
                      onClick={() => submitAnswer(reply)}
                      disabled={pending}
                      className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-muted disabled:opacity-50"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              ) : null}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitAnswer(freeText);
                }}
                className="flex gap-2 pl-8"
              >
                <input
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Type your answer…"
                  disabled={pending}
                  className="flex-1 rounded-button border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent disabled:opacity-60"
                />
                <Button type="submit" disabled={pending || !freeText.trim()} className="px-3 py-1.5 text-xs">
                  Send
                </Button>
              </form>
            </div>
          ) : stage === "understanding" ? (
            <p className="pl-8 text-xs text-ink-muted">Thinking…</p>
          ) : null}
        </div>
      ) : stage === "understanding" ? (
        <p className="mt-3 text-xs text-ink-muted">Understanding your search…</p>
      ) : null}

      {inPipeline ? (
        <div className="mt-4 flex flex-col gap-2 rounded-button border border-line bg-surface-muted p-3">
          {STAGE_ORDER.map((s, i) => {
            const info = STAGE_INFO[s as keyof typeof STAGE_INFO];
            const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "upcoming";
            return (
              <div key={s} className="flex items-start gap-2.5">
                <span
                  className={
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full " +
                    (state === "done"
                      ? "bg-accent text-white"
                      : state === "active"
                        ? "border-2 border-accent"
                        : "border-2 border-line")
                  }
                >
                  {state === "done" ? <Icon name="check" size={9} /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={
                        "text-sm font-medium " + (state === "upcoming" ? "text-ink-muted" : "text-ink")
                      }
                    >
                      {info.label}
                    </span>
                    {info.tag ? (
                      <span className="rounded-full bg-nets-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                        {info.tag}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-ink-muted">{info.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-danger-strong">{error}</p> : null}

      {results && results.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Live search via Exa, ranked by Claude — payment simulated through your NETS Quest wallet.
          </p>
          {results.map((deal, i) => (
            <div key={`${deal.url}-${i}`} className="rounded-button border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {i === 0 ? (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                        Top Pick
                      </span>
                    ) : null}
                    <p className="truncate text-sm font-semibold text-ink">{deal.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{deal.snippet}</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-ink">
                  {deal.priceCents != null ? formatMoney(deal.priceCents, currency) : "Price not listed"}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] font-medium text-ink-muted">Deal Score</span>
                <ProgressBar value={deal.dealScore / 100} size="sm" />
                <span className="w-7 shrink-0 text-right text-[11px] text-ink-muted">{deal.dealScore}</span>
              </div>

              {deal.factors.length > 0 ? (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {deal.factors.map((f, fi) => (
                    <div key={fi} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 truncate text-[11px] text-ink-muted">{f.label}</span>
                      {f.available && f.score != null ? (
                        <>
                          <ProgressBar value={f.score / 100} size="sm" />
                          <span className="w-7 shrink-0 text-right text-[11px] text-ink-muted">
                            {f.score}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] italic text-ink-muted">Not available from this listing</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              <details className="mt-2 text-xs">
                <summary className="cursor-pointer font-medium text-accent">
                  Why this ranked here
                </summary>
                <p className="mt-1 text-ink-muted">{deal.why}</p>
              </details>

              <a
                href={deal.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block truncate text-[11px] text-ink-muted underline"
              >
                {deal.url}
              </a>

              {deal.priceCents != null ? (
                <Button
                  type="button"
                  onClick={() => openCheckout(deal)}
                  className="mt-3 w-full justify-center"
                >
                  Authorise & Pay with NETS
                </Button>
              ) : (
                <p className="mt-3 text-center text-[11px] text-ink-muted">
                  No price detected for this listing — can&apos;t simulate payment.
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
