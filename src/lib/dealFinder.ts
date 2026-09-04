// AI Deal Finder — pure helpers ONLY (price extraction regex, deterministic
// gating/clamping math, shared types). No API calls and no LLM calls live
// here — this is not a separate "agent module"; it's the same kind of
// pure-logic support file as savingsGoals.ts. The actual Claude intent call,
// Exa search call, and Claude scoring call all live in actions.ts
// (analyzeSearchIntent and findDeals).

// Exa returns page text/snippets, not a structured price field, so a price
// is best-effort extracted from the real result text via regex — never
// invented. A result with no matched price shows honestly as "price not
// listed" rather than a guessed number.
const PRICE_RE = /\$\s?([\d,]+(?:\.\d{1,2})?)/;

export function extractPriceCents(text: string): number | null {
  const match = text.match(PRICE_RE);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export function clampScore(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

// --- Intent understanding ----------------------------------------------------
// Before searching, Claude extracts what the user is asking for into a set
// of slots — deliberately NOT a fixed per-category schema (no hardcoded
// "flights need origin" list anywhere in code). Claude decides, per request,
// which slots matter and whether each is EXPLICIT (user said it), INFERRED
// (a safe, low-risk default), or UNKNOWN. The gate on whether to search yet
// is deterministic code, not the model's own say-so: see
// hasUnresolvedCriticalSlot below, which is the ONLY thing standing between
// a request and a search — a slot Claude marks `critical` and leaves
// UNKNOWN always blocks searching, full stop.

export type FieldStatus = "EXPLICIT" | "INFERRED" | "UNKNOWN";

export type IntentSlot = {
  name: string;
  value: string | null;
  status: FieldStatus;
  critical: boolean;
};

export type SearchIntent = {
  category: string;
  slots: IntentSlot[];
  // Derived deterministically from slots in actions.ts (see
  // hasUnresolvedCriticalSlot) — never taken as the model's own claim.
  readyToSearch: boolean;
  clarifyingQuestion: string | null;
  quickReplies: string[];
};

export function hasUnresolvedCriticalSlot(slots: IntentSlot[]): boolean {
  return slots.some((s) => s.critical && s.status === "UNKNOWN");
}

// One resolved Q&A round of the mini-clarification chat. Free text is always
// allowed alongside quick-reply chips — a user can answer "Singapore, 2
// people, under $700" to a single "where are you flying from?" question, and
// the next analyze_intent call re-parses the whole conversation and picks up
// all three.
export type ClarifyTurn = { question: string; answer: string };

// --- Ranking ------------------------------------------------------------
// One evidence-based Deal Score (0-100) plus 2-4 factors Claude names itself
// per result category (never a fixed Value/Speed/Quality triple, which meant
// nothing for e.g. a flight). A factor Claude can't actually support from
// the listing text is marked unavailable — score stays null, never guessed.
export type DealFactor = { label: string; score: number | null; available: boolean };

export type RankedDeal = {
  title: string;
  url: string;
  priceCents: number | null;
  snippet: string;
  dealScore: number;
  factors: DealFactor[];
  why: string;
};
