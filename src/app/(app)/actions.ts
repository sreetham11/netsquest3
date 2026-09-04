"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import twilio from "twilio";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  CASHBACK_REWARD_NAME,
  POINTS_PER_DOLLAR_REDEEMED,
  centsFromPoints,
  maxMilesDiscountCents,
  pointsForCents,
  pointsForSpendCents,
  tierForMonthlyCount,
} from "@/lib/rewards";
import {
  getMonthlyQualifyingPaymentCount,
  getGoalCoachSpendingStats,
  startOfThisMonth,
} from "@/lib/data/queries";
import { triggerAutoTopupIfNeeded } from "@/lib/autoTopup";
import {
  requiredMonthlySavings,
  estimateDaysSooner,
  spendCutCandidates,
  GENERAL_SAVING_TIPS,
  NOT_SURE_OPTION,
  type GoalCoachResult,
  type SpendCutCandidate,
  type ClarifyingQuestion,
  type ClarifyingAnswer,
  type GoalSpendSuggestion,
} from "@/lib/savingsGoals";
import { formatMoney } from "@/lib/format";
import {
  extractPriceCents,
  clampScore,
  hasUnresolvedCriticalSlot,
  type FieldStatus,
  type IntentSlot,
  type SearchIntent,
  type ClarifyTurn,
  type DealFactor,
  type RankedDeal,
} from "@/lib/dealFinder";

// All of these are SIMULATED money movements — they only write rows to Postgres
// via Prisma. No real payment processing.

export async function topUp(formData: FormData) {
  const user = await requireUser();
  const amountCents = Math.round(Number(formData.get("amount")) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) return;

  await prisma.$transaction([
    prisma.account.update({
      where: { userId: user.id },
      data: { balanceCents: { increment: amountCents } },
    }),
    prisma.transaction.create({
      data: {
        userId: user.id,
        description: "Top-up",
        category: "Top-up",
        amountCents,
        type: "TOPUP",
      },
    }),
  ]);

  revalidatePath("/home");
  revalidatePath("/transactions");
}

// Splits are instant and name-only — no invites, no real linked accounts, no
// balance/points effect. "paid" is a status toggle only, not a real payment.
//
// Shaped as (prevState, formData) => State for useActionState, so the client
// form (NewSplitForm) can tell success apart from validation failure and
// reset/collapse itself — same pattern as src/app/auth/AuthForm.tsx.
export type CreateSplitState = { ok: boolean } | null;

export async function createSplit(
  _prev: CreateSplitState,
  formData: FormData,
): Promise<CreateSplitState> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const totalAmountCents = Math.round(Number(formData.get("totalAmount")) * 100);
  const category = String(formData.get("category") ?? "General").trim() || "General";
  if (!title || !Number.isFinite(totalAmountCents) || totalAmountCents <= 0) {
    return { ok: false };
  }

  let participants: Array<{ name: string; shareAmountCents: number; contactId?: string | null }>;
  try {
    participants = JSON.parse(String(formData.get("participants") ?? "[]"));
  } catch {
    return { ok: false };
  }
  if (!Array.isArray(participants) || participants.length === 0) return { ok: false };

  const cleaned = participants
    .map((p) => ({
      name: String(p?.name ?? "").trim(),
      shareAmountCents: Math.round(Number(p?.shareAmountCents)),
      contactId: p?.contactId ? String(p.contactId) : null,
    }))
    .filter((p) => p.name && Number.isFinite(p.shareAmountCents) && p.shareAmountCents >= 0);
  if (cleaned.length === 0) return { ok: false };

  // Shares must add up to the total — reject on tamper/rounding bugs,
  // consistent with this file's existing minimal-validation style.
  const sum = cleaned.reduce((s, p) => s + p.shareAmountCents, 0);
  if (sum !== totalAmountCents) return { ok: false };

  // Only link contacts this user actually owns — a contactId from the client
  // is otherwise an arbitrary id. Anything unrecognised falls back to a
  // freeform participant, which is a valid state, so it isn't an error.
  const ownedContactIds = new Set(
    (
      await prisma.contact.findMany({
        where: {
          userId: user.id,
          id: { in: cleaned.map((p) => p.contactId).filter((id): id is string => Boolean(id)) },
        },
        select: { id: true },
      })
    ).map((c) => c.id),
  );

  await prisma.split.create({
    data: {
      ownerId: user.id,
      title,
      totalAmountCents,
      category,
      participants: {
        create: cleaned.map((p) => ({
          // `name` is written for BOTH kinds of participant and never rewritten,
          // so the split still reads correctly if the contact is later renamed
          // or deleted.
          name: p.name,
          shareAmountCents: p.shareAmountCents,
          contactId: p.contactId && ownedContactIds.has(p.contactId) ? p.contactId : null,
        })),
      },
    },
  });

  revalidatePath("/split");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Spin to Decide — payer of record only.
//
// The base equal/custom split (createSplit above) is untouched: shares are
// computed before any spin and are never recalculated by it. The wheel NEVER
// makes one participant absorb the whole bill — the payer of record FRONTS it
// and everyone else then owes their unchanged share back.
// ---------------------------------------------------------------------------

export type SpinResult =
  | { ok: true; payerParticipantId: string; payerName: string }
  | { ok: false; error: string };

// Randomness is decided HERE (server-side) so the client can only animate to a
// result it was given, never choose one. A split may be spun exactly once.
export async function spinSplit(splitId: string): Promise<SpinResult> {
  const user = await requireUser();

  const split = await prisma.split.findFirst({
    where: { id: splitId, ownerId: user.id },
    include: { participants: { orderBy: { id: "asc" } } },
  });
  if (!split) return { ok: false, error: "Something went wrong. Try again." };
  if (split.spunAt) return { ok: false, error: "This split has already been spun." };
  if (split.participants.length === 0) {
    return { ok: false, error: "Add someone to the split first." };
  }

  const payer = split.participants[randomInt(split.participants.length)];

  // Guarded on spunAt so a double-submit can't overwrite an existing result.
  const updated = await prisma.split.updateMany({
    where: { id: split.id, ownerId: user.id, spunAt: null },
    data: { payerParticipantId: payer.id, spunAt: new Date() },
  });
  if (updated.count === 0) {
    return { ok: false, error: "This split has already been spun." };
  }

  revalidatePath("/split");
  return { ok: true, payerParticipantId: payer.id, payerName: payer.name };
}

export async function toggleSplitParticipantPaid(formData: FormData) {
  const user = await requireUser();
  const participantId = String(formData.get("participantId") ?? "");
  if (!participantId) return;

  const participant = await prisma.splitParticipant.findFirst({
    where: { id: participantId, split: { ownerId: user.id } },
  });
  if (!participant) return;

  await prisma.splitParticipant.update({
    where: { id: participant.id },
    data: { paid: !participant.paid },
  });

  revalidatePath("/split");
}

// Shaped as (prevState, formData) => State (same pattern as createSplit)
// so the confirmation step in BillCard can show a real error — insufficient
// balance, or a double-submit race — instead of failing silently.
export type PayBillState = { ok: boolean; error?: string } | null;

export async function payBill(_prev: PayBillState, formData: FormData): Promise<PayBillState> {
  const user = await requireUser();
  const billId = String(formData.get("billId") ?? "");
  if (!billId) return { ok: false, error: "Something went wrong. Try again." };

  const applyMiles = formData.get("applyMiles") === "on";

  const [bill, account, monthlyPaymentCount] = await Promise.all([
    prisma.recurringBill.findFirst({ where: { id: billId, userId: user.id } }),
    prisma.account.findUnique({ where: { userId: user.id } }),
    getMonthlyQualifyingPaymentCount(user.id),
  ]);
  if (!bill || !account) return { ok: false, error: "Something went wrong. Try again." };

  // Same "already covered this cycle" rule the Bills page uses to hide the
  // Pay button (getSpendingPlan uses it too) — enforced server-side so a
  // double-click or a slow-network double-submit can't charge the bill twice.
  if (bill.lastPaidAt && bill.lastPaidAt >= startOfThisMonth()) {
    return { ok: false, error: "This bill is already paid for this month." };
  }

  // Miles discount, recomputed server-side — the client's toggle only says
  // "apply", never how much. The 50%-of-payment cap is a hard business rule
  // and is enforced HERE, not in the UI.
  const discountCents = applyMiles
    ? maxMilesDiscountCents(bill.amountCents, account.rewardPoints)
    : 0;
  const pointsSpent = discountCents > 0 ? pointsForCents(discountCents) : 0;
  const chargeCents = bill.amountCents - discountCents;

  if (account.balanceCents < chargeCents) {
    return { ok: false, error: "Insufficient balance to pay this bill." };
  }

  // Tier multiplier comes from this month's qualifying payments so far, and
  // points are earned on what is actually charged (post-discount).
  const { multiplier } = tierForMonthlyCount(monthlyPaymentCount);
  const pointsEarned = pointsForSpendCents(chargeCents, multiplier);

  // Interactive transaction (not the array form) so triggerAutoTopupIfNeeded
  // can read the just-decremented balance and, if needed, credit it back
  // within the SAME commit — the bill payment and any resulting auto-topup
  // are genuinely atomic, not two separate writes.
  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { userId: user.id },
      data: {
        balanceCents: { decrement: chargeCents },
        // One net movement so earn and spend settle atomically together.
        rewardPoints: { increment: pointsEarned - pointsSpent },
      },
    });
    await tx.transaction.create({
      data: {
        userId: user.id,
        description: bill.name,
        category: bill.category,
        amountCents: -chargeCents,
        type: "BILL",
      },
    });
    await tx.recurringBill.update({
      where: { id: bill.id },
      data: { lastPaidAt: new Date() },
    });
    await triggerAutoTopupIfNeeded(tx, user.id);
  });

  revalidatePath("/bills");
  revalidatePath("/home");
  revalidatePath("/rewards");
  revalidatePath("/transactions");
  return { ok: true };
}

// Redemption path #2 — direct cashback into the wallet balance at 100:1.
// Recorded through the existing Redemption model, against the reserved
// "Cashback" catalogue row (upserted here so existing accounts, whose
// catalogue was seeded before this row existed, still work).
export type RedeemCashbackState = { ok: boolean; error?: string } | null;

export async function redeemCashback(
  _prev: RedeemCashbackState,
  formData: FormData,
): Promise<RedeemCashbackState> {
  const user = await requireUser();
  const requested = Math.floor(Number(formData.get("points")));

  if (!Number.isFinite(requested) || requested <= 0) {
    return { ok: false, error: "Enter how many Miles to redeem." };
  }

  // Redeem in whole dollars — i.e. whole multiples of 100 points.
  const points =
    Math.floor(requested / POINTS_PER_DOLLAR_REDEEMED) * POINTS_PER_DOLLAR_REDEEMED;
  if (points <= 0) {
    return { ok: false, error: `Redeem at least ${POINTS_PER_DOLLAR_REDEEMED} Miles ($1.00).` };
  }

  const account = await prisma.account.findUnique({ where: { userId: user.id } });
  if (!account) return { ok: false, error: "Something went wrong. Try again." };
  if (account.rewardPoints < points) {
    return { ok: false, error: "You don't have enough Miles for that." };
  }

  const cashCents = centsFromPoints(points);

  const cashbackReward = await prisma.reward.upsert({
    where: { name: CASHBACK_REWARD_NAME },
    create: {
      name: CASHBACK_REWARD_NAME,
      pointCost: POINTS_PER_DOLLAR_REDEEMED,
      category: "voucher",
      sortOrder: 99,
    },
    update: {},
  });

  await prisma.$transaction([
    prisma.account.update({
      where: { userId: user.id },
      data: {
        rewardPoints: { decrement: points },
        balanceCents: { increment: cashCents },
      },
    }),
    prisma.redemption.create({
      data: { userId: user.id, rewardId: cashbackReward.id, pointsSpent: points },
    }),
    prisma.transaction.create({
      data: {
        userId: user.id,
        description: "Cashback redeemed",
        category: "Rewards",
        amountCents: cashCents,
        type: "REWARD",
      },
    }),
  ]);

  revalidatePath("/rewards");
  revalidatePath("/home");
  revalidatePath("/transactions");
  return { ok: true };
}

export async function redeemReward(formData: FormData) {
  const user = await requireUser();
  const rewardId = String(formData.get("rewardId") ?? "");
  if (!rewardId) return;

  const [account, reward] = await Promise.all([
    prisma.account.findUnique({ where: { userId: user.id } }),
    prisma.reward.findUnique({ where: { id: rewardId } }),
  ]);
  if (!account || !reward) return;
  if (account.rewardPoints < reward.pointCost) return;

  await prisma.$transaction([
    prisma.account.update({
      where: { userId: user.id },
      data: { rewardPoints: { decrement: reward.pointCost } },
    }),
    prisma.redemption.create({
      data: {
        userId: user.id,
        rewardId: reward.id,
        pointsSpent: reward.pointCost,
      },
    }),
    prisma.transaction.create({
      data: {
        userId: user.id,
        description: `Redeemed: ${reward.name}`,
        category: "Rewards",
        amountCents: 0,
        type: "REWARD",
      },
    }),
  ]);

  revalidatePath("/rewards");
  revalidatePath("/home");
  revalidatePath("/transactions");
}

// One action for both "add a new category cap" and "edit an existing one" —
// BudgetCap is unique on (userId, category), so an upsert covers both: a
// fresh category creates the row, a category that already has a cap just
// updates its limit.
export type SaveBudgetCapState = { ok: boolean; error?: string } | null;

export async function saveBudgetCap(
  _prev: SaveBudgetCapState,
  formData: FormData,
): Promise<SaveBudgetCapState> {
  const user = await requireUser();
  const category = String(formData.get("category") ?? "").trim();
  const limitCents = Math.round((Number(formData.get("limitAmount")) || 0) * 100);

  if (!category) return { ok: false, error: "Choose a category." };
  if (!Number.isFinite(limitCents) || limitCents <= 0) {
    return { ok: false, error: "Enter a monthly cap greater than $0." };
  }

  await prisma.budgetCap.upsert({
    where: { userId_category: { userId: user.id, category } },
    create: { userId: user.id, category, limitCents },
    update: { limitCents },
  });

  revalidatePath("/budget");
  revalidatePath("/home");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Contacts — saved payees, managed entirely by the user.
//
// These are names/numbers for faster, consistent entry in Split. There is NO
// messaging, invite, notification, or user-lookup logic tied to phoneNumber —
// it is stored and displayed, nothing more. Creating a contact does not create
// or link a real account, and never moves money.
// ---------------------------------------------------------------------------

// Returns the created row on success so the Split form can link the
// participant it just saved to its new contactId without a round-trip.
export type SaveContactState =
  | { ok: true; contact: { id: string; name: string } }
  | { ok: false; error: string }
  | null;

export async function createContact(
  _prev: SaveContactState,
  formData: FormData,
): Promise<SaveContactState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  // Optional and cosmetic — kept as free text so any local format works.
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();

  if (!name) return { ok: false, error: "Enter a name." };

  // Same-name contacts would be indistinguishable as chips, so treat the name
  // as the natural key per user rather than silently creating a duplicate.
  const existing = await prisma.contact.findFirst({
    where: { userId: user.id, name },
  });
  if (existing) return { ok: false, error: `${name} is already saved.` };

  const contact = await prisma.contact.create({
    data: { userId: user.id, name, phoneNumber: phoneNumber || null },
  });

  revalidatePath("/contacts");
  revalidatePath("/split");
  return { ok: true, contact: { id: contact.id, name: contact.name } };
}

export async function deleteContact(formData: FormData) {
  const user = await requireUser();
  const contactId = String(formData.get("contactId") ?? "");
  if (!contactId) return;

  // Scoped delete: deleteMany with the ownership filter means another user's
  // id in the form is a no-op rather than a delete. Past splits keep working —
  // SplitParticipant.contactId is ON DELETE SET NULL and the participant's
  // name stays on the row.
  await prisma.contact.deleteMany({ where: { id: contactId, userId: user.id } });

  revalidatePath("/contacts");
  revalidatePath("/split");
}

// ---------------------------------------------------------------------------
// Scan & Pay — a real merchant payment (Scan & Pay's actual destination).
// Same debit + points-earning shape as payBill (same tier-multiplier system,
// same "insufficient balance" guard), just for a one-off merchant/amount
// instead of a recurring bill. PayForm's QR "scan" is simulated (no live
// camera) — "Simulate Scan" is the only path through that screen, always
// resolving to the same fixed demo merchant (PayForm's DEFAULT_MERCHANT).
// ---------------------------------------------------------------------------

export type MakePaymentState =
  | { ok: true; newBalanceCents: number; pointsEarned: number }
  | { ok: false; error: string }
  | null;

export async function makePayment(
  _prev: MakePaymentState,
  formData: FormData,
): Promise<MakePaymentState> {
  const user = await requireUser();
  const merchant = String(formData.get("merchant") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || "Shopping";
  const amountCents = Math.round(Number(formData.get("amount")) * 100);

  if (!merchant) return { ok: false, error: "Enter who you're paying." };
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Enter an amount greater than $0." };
  }

  const [account, monthlyPaymentCount] = await Promise.all([
    prisma.account.findUnique({ where: { userId: user.id } }),
    getMonthlyQualifyingPaymentCount(user.id),
  ]);
  if (!account) return { ok: false, error: "Something went wrong. Try again." };

  if (account.balanceCents < amountCents) {
    return { ok: false, error: "Insufficient balance to complete this payment." };
  }

  // Same tier-multiplier formula payBill uses — one earn-rate system, not a
  // second one invented for this entry point.
  const { multiplier } = tierForMonthlyCount(monthlyPaymentCount);
  const pointsEarned = pointsForSpendCents(amountCents, multiplier);

  let newBalanceCents = account.balanceCents - amountCents;
  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { userId: user.id },
      data: {
        balanceCents: { decrement: amountCents },
        rewardPoints: { increment: pointsEarned },
      },
    });
    await tx.transaction.create({
      data: {
        userId: user.id,
        description: merchant,
        category,
        amountCents: -amountCents,
        type: "PAYMENT",
      },
    });
    await triggerAutoTopupIfNeeded(tx, user.id);
    // Re-read AFTER the possible auto-topup so the success message reflects
    // the real final balance, not the pre-topup figure.
    const final = await tx.account.findUnique({ where: { userId: user.id } });
    if (final) newBalanceCents = final.balanceCents;
  });

  revalidatePath("/home");
  revalidatePath("/rewards");
  revalidatePath("/transactions");
  return { ok: true, newBalanceCents, pointsEarned };
}

// ---------------------------------------------------------------------------
// Auto Top-up settings — local to the Account row, checked by
// triggerAutoTopupIfNeeded after every balance-decreasing write.
// ---------------------------------------------------------------------------

export type SaveAutoTopupState = { ok: boolean; error?: string } | null;

export async function saveAutoTopupSettings(
  _prev: SaveAutoTopupState,
  formData: FormData,
): Promise<SaveAutoTopupState> {
  const user = await requireUser();
  const enabled = formData.get("enabled") === "on";
  const thresholdCents = Math.round((Number(formData.get("threshold")) || 0) * 100);
  const topupAmountCents = Math.round((Number(formData.get("amount")) || 0) * 100);

  // Only enforced strictly when actually turning it ON — a disabled row's
  // numbers are inert, so they're saved as-is (even 0/blank) rather than
  // rejected, the same way re-opening this form later should show whatever
  // was last typed.
  if (enabled) {
    if (!(thresholdCents > 0)) {
      return { ok: false, error: "Enter a threshold greater than $0." };
    }
    if (!(topupAmountCents > 0)) {
      return { ok: false, error: "Enter a top-up amount greater than $0." };
    }
    // Guarantees the post-topup balance always clears the threshold, so a
    // single top-up can never immediately re-trigger itself.
    if (topupAmountCents <= thresholdCents) {
      return { ok: false, error: "Top-up amount must be more than the threshold." };
    }
  }

  await prisma.account.update({
    where: { userId: user.id },
    data: {
      autoTopupEnabled: enabled,
      autoTopupThresholdCents: thresholdCents || null,
      autoTopupAmountCents: topupAmountCents || null,
    },
  });

  revalidatePath("/auto-topup");
  revalidatePath("/home");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Savings Goals — goal-based planning. Entirely new/additive: reads Account
// and Transaction (via getGoalCoachSpendingStats) but never writes to
// either, and never touches Budget/BudgetCap.
//
// There is deliberately NO AI call at goal creation any more. An earlier
// version asked Claude for a per-goal cost breakdown (e.g. a $100 "Protein
// powder" goal came back with an invented "Whey Protein Tub / Shaker Bottle /
// Flavor Variety" shopping list) — the goal name is descriptive context only,
// never a request to price out a basket of products. requiredMonthlySavings
// (pure math, src/lib/savingsGoals.ts) is the only thing that ever computes
// the "$X/month" figure shown in the UI.
//
// The one remaining Claude call (explainSpendCuts below) powers the AI Goal
// Coach: it is only ever handed candidate categories and their real spend
// numbers, already computed in code, and asked for a one-sentence
// explanation — never a category, a dollar amount, or a date. See
// GoalCoachResult in savingsGoals.ts for the full contract.
// ---------------------------------------------------------------------------

export type CreateSavingsGoalState = { ok: true } | { ok: false; error: string } | null;

export async function createSavingsGoal(
  _prev: CreateSavingsGoalState,
  formData: FormData,
): Promise<CreateSavingsGoalState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const targetAmountCents = Math.round((Number(formData.get("targetAmount")) || 0) * 100);
  const currentSavedCents = Math.round((Number(formData.get("currentSaved")) || 0) * 100);
  const targetDateRaw = String(formData.get("targetDate") ?? "");
  const targetDate = targetDateRaw ? new Date(`${targetDateRaw}T00:00:00`) : null;

  if (!name) return { ok: false, error: "Give this goal a name." };
  if (!Number.isFinite(targetAmountCents) || targetAmountCents <= 0) {
    return { ok: false, error: "Enter a target amount greater than $0." };
  }
  if (!targetDate || Number.isNaN(targetDate.getTime())) {
    return { ok: false, error: "Choose a target date." };
  }
  if (targetDate.getTime() <= Date.now()) {
    return { ok: false, error: "Target date must be in the future." };
  }
  if (!Number.isFinite(currentSavedCents) || currentSavedCents < 0 || currentSavedCents > targetAmountCents) {
    return { ok: false, error: "Already-saved amount can't be negative or exceed the target." };
  }

  await prisma.savingsGoal.create({
    data: {
      userId: user.id,
      name,
      targetAmountCents,
      currentSavedCents,
      targetDate,
    },
  });

  revalidatePath("/savings-goals");
  return { ok: true };
}

export type UpdateSavingsProgressState = { ok: true } | { ok: false; error: string } | null;

export async function updateSavingsGoalProgress(
  _prev: UpdateSavingsProgressState,
  formData: FormData,
): Promise<UpdateSavingsProgressState> {
  const user = await requireUser();
  const goalId = String(formData.get("goalId") ?? "");
  const savedCents = Math.round((Number(formData.get("saved")) || 0) * 100);

  if (!Number.isFinite(savedCents) || savedCents < 0) {
    return { ok: false, error: "Enter an amount of $0 or more." };
  }

  // Scoped update: goalId + userId together means another user's id in the
  // form is a no-op, never a cross-account write.
  const result = await prisma.savingsGoal.updateMany({
    where: { id: goalId, userId: user.id },
    data: { currentSavedCents: savedCents },
  });
  if (result.count === 0) return { ok: false, error: "Couldn't find that goal." };

  revalidatePath("/savings-goals");
  return { ok: true };
}

// The only tool schema left in this feature — deliberately has NO numeric
// field. Claude is handed categories + real numbers it cannot change and
// asked only to write a sentence about them; there is nothing here for it to
// invent, and nothing it returns is ever treated as a source of truth for an
// amount.
const EXPLAIN_SPEND_CUTS_TOOL: Anthropic.Tool = {
  name: "explain_spend_cuts",
  description:
    "Write one short, encouraging sentence of reasoning for each given spending-cut candidate, using only the real numbers already provided. Never invent a category or a dollar amount — those are fixed; only explain them.",
  input_schema: {
    type: "object",
    properties: {
      explanations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Must exactly match one of the category names given in the prompt.",
            },
            reasoning: {
              type: "string",
              description:
                "One short sentence connecting this category's real spend numbers (already given) to the savings goal. No new numbers, no invented categories.",
            },
          },
          required: ["category", "reasoning"],
        },
      },
    },
    required: ["explanations"],
  },
};

// Best-effort reasoning text for a set of already-decided candidates (see
// spendCutCandidates in savingsGoals.ts, which picks the categories and
// computes suggestedReductionCents — this function never does either). Falls
// back to a generic, still-true sentence per category if the API key is
// unset or the call fails — the AI Goal Coach must never block on this, and
// a missing sentence must never turn into a missing (or fabricated) number.
async function explainSpendCuts(
  context: string,
  candidates: SpendCutCandidate[],
): Promise<Record<string, string>> {
  const fallback: Record<string, string> = {};
  for (const c of candidates) {
    fallback[c.category] =
      "This is above your recent average — cutting back here could help fund this goal.";
  }
  if (!process.env.ANTHROPIC_API_KEY || candidates.length === 0) return fallback;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const facts = candidates
      .map(
        (c) =>
          `${c.category}: spent $${(c.currentPeriodCents / 100).toFixed(2)} this month vs a $${(c.averageMonthlyCents / 100).toFixed(2)}/month average (a $${(c.suggestedReductionCents / 100).toFixed(2)} cut is suggested)`,
      )
      .join("; ");
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      tools: [EXPLAIN_SPEND_CUTS_TOOL],
      tool_choice: { type: "tool", name: "explain_spend_cuts" },
      messages: [
        {
          role: "user",
          content: `A user is saving toward a goal called "${context}". Here are real, already-computed spending-cut candidates from their transaction history: ${facts}. Call explain_spend_cuts with one short, encouraging sentence of reasoning per category, referencing only the numbers already given above. Do not propose different categories or different dollar amounts — those are fixed; you are only explaining them.`,
        },
      ],
    });
    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return fallback;

    const input = toolUse.input as { explanations?: unknown };
    const rows = normalizeToolArray(input.explanations, "explanations");
    const byCategory: Record<string, string> = {};
    for (const row of rows) {
      const category = String(row?.category ?? "").trim();
      const reasoning = String(row?.reasoning ?? "").trim();
      // Only ever trust a reasoning line for a category actually asked
      // about — an invented category name is dropped, not surfaced.
      if (category && reasoning && candidates.some((c) => c.category === category)) {
        byCategory[category] = reasoning;
      }
    }
    return { ...fallback, ...byCategory };
  } catch (err) {
    console.error("explainSpendCuts: Anthropic call failed", err);
    return fallback;
  }
}

export type RefreshSuggestionsResult = { ok: true; result: GoalCoachResult } | { ok: false; error: string };

// Not a useActionState action (no form fields, just an id) — same shape as
// spinSplit: a plain async function the client calls directly via
// useTransition. Always recomputes from the latest transaction stats (no
// caching, no randomness) — "Refresh suggestions" calling this again is a
// real recomputation, not a new random AI response.
export async function refreshGoalSuggestions(goalId: string): Promise<RefreshSuggestionsResult> {
  const user = await requireUser();
  const goal = await prisma.savingsGoal.findFirst({ where: { id: goalId, userId: user.id } });
  if (!goal) return { ok: false, error: "Couldn't find that goal." };

  const required = requiredMonthlySavings(goal);
  if (required.remainingCents <= 0) {
    return { ok: false, error: "This goal is already fully funded — no cuts needed." };
  }

  const history = await getGoalCoachSpendingStats(user.id);

  let result: GoalCoachResult;
  if (!history.hasEnoughHistory) {
    // General mode: no AI call at all — just the deterministic pace figures
    // and a fixed set of generic tips. Never phrased as personalized.
    result = {
      mode: "general",
      remainingCents: required.remainingCents,
      weeklyCents: required.weeklyCents,
      monthlyCents: required.monthlyCents,
      tips: GENERAL_SAVING_TIPS.slice(0, 2),
    };
  } else {
    const candidates = spendCutCandidates(history.categories);
    if (candidates.length === 0) {
      result = { mode: "no-candidates" };
    } else {
      const reasoningByCategory = await explainSpendCuts(goal.name, candidates);
      const suggestions = candidates.map((c) => ({
        ...c,
        daysSooner: estimateDaysSooner(goal, c.suggestedReductionCents),
        reasoning: reasoningByCategory[c.category],
      }));
      result = { mode: "personalized", suggestions };
    }
  }

  await prisma.savingsGoal.update({
    where: { id: goal.id },
    data: { aiSuggestions: JSON.stringify(result), aiSuggestionsAt: new Date() },
  });
  revalidatePath("/savings-goals");
  return { ok: true, result };
}

// --- "Help me estimate" intake flow -----------------------------------------
// Two Claude calls, same forced-tool-use/fail-gracefully family as
// explainSpendCuts/refreshGoalSuggestions above, but on-demand from the New
// Goal form (never at creation, never persisted). Step 1 asks 2-3 short
// tap-only clarifying questions; step 2 turns the user's picks into a
// grounded estimate. Both are called directly by the client via
// useTransition, same as refreshGoalSuggestions — no form fields, just a
// name (and, for step 2, the answers).

// Tool-use JSON quirk (see the "Tool call JSON parsing" pitfall for Sonnet/
// Opus 4.6+ models — different escaping/serialization of tool inputs):
// confirmed live on a real call, an array-typed field can come back as a
// JSON-encoded STRING instead of a native array — sometimes even
// double-wrapped under the same key (e.g. `{questions: "{\"questions\":[...]}"}`
// instead of `{questions: [...]}`). Plain `Array.isArray(raw) ? raw : []`
// correctly (but unhelpfully) treats that string as "no data" and silently
// discards a perfectly good response — reproduced with generate_questions on
// a "Gym protein powder" goal, where 3 good questions were thrown away and
// misreported as "the AI couldn't come up with anything". This normalizes
// both shapes before validation instead of dropping good data.
function normalizeToolArray(raw: unknown, wrapperKey: string): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.[wrapperKey])) return parsed[wrapperKey];
    } catch {
      // Not JSON either — fall through to the empty-array return below.
    }
  }
  return [];
}

const GENERATE_QUESTIONS_TOOL: Anthropic.Tool = {
  name: "generate_questions",
  description:
    "Record 2-3 short clarifying questions, each with tap-only answer choices, to help estimate the cost of a savings goal.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        // Always at least 1 — even a simple, well-defined goal (e.g. "Gym
        // protein powder") has SOME cost-relevant variable (size, brand tier,
        // how often). An empty array here means the client has nothing to
        // show and silently drops straight to the generic fallback estimate,
        // skipping the dynamic flow entirely — this floor is what prevents
        // that for goals the model might otherwise judge "too simple to ask
        // about".
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description:
                "A short question specific to this exact kind of goal — the kind of detail that meaningfully changes the cost (e.g. for a trip: destination region, trip length, travel style; for a single purchase: size/quantity, brand/quality tier, how often; adapt entirely to what this goal actually is).",
            },
            options: {
              type: "array",
              minItems: 3,
              maxItems: 4,
              items: { type: "string" },
              description:
                "3-4 short answer choices (a few words each, e.g. \"Under a week\", \"1-2 weeks\") covering a realistic range for this question. Do NOT include an \"I'm not sure\" option — that's added separately.",
            },
          },
          required: ["question", "options"],
        },
      },
    },
    required: ["questions"],
  },
};

export type GenerateQuestionsResult =
  | { ok: true; questions: ClarifyingQuestion[] }
  | { ok: false; error: string };

// Caps at 3 questions even if the model returns more, and appends
// NOT_SURE_OPTION in code (see savingsGoals.ts) — never asked of the model,
// so it's guaranteed present and worded identically on every question.
export async function generateGoalClarifyingQuestions(goalName: string): Promise<GenerateQuestionsResult> {
  const name = goalName.trim();
  if (!name) return { ok: false, error: "Give this goal a name first." };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "AI estimates aren't set up yet — the AI key isn't configured." };
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 512,
      tools: [GENERATE_QUESTIONS_TOOL],
      tool_choice: { type: "tool", name: "generate_questions" },
      messages: [
        {
          role: "user",
          content: `A user is setting a savings goal called "${name}" and doesn't know how much to save toward it. Call generate_questions with 1-3 short clarifying questions specific to this exact kind of goal — the details that would change the cost a lot. Even a simple, well-defined goal (e.g. a single purchase) has at least one useful cost-relevant variable — size/quantity, brand or quality tier, how often, etc. — so always return AT LEAST 1 question; never return zero. Every question MUST be answerable by tapping one short button: no open-ended questions, nothing that needs typed numbers or free text. Give each question 3-4 short answer options (a few words each) covering a realistic range. Keep this fast — 3 questions maximum.`,
        },
      ],
    });
    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { ok: false, error: "Couldn't generate questions right now. Try again, or enter an amount yourself." };
    }

    const input = toolUse.input as { questions?: unknown };
    const questions: ClarifyingQuestion[] = normalizeToolArray(input.questions, "questions")
      .slice(0, 3)
      .map((q) => ({
        question: String(q?.question ?? "").trim(),
        options: (Array.isArray(q?.options) ? q.options : [])
          .map((o) => String(o ?? "").trim())
          .filter(Boolean)
          .slice(0, 4)
          .concat(NOT_SURE_OPTION),
      }))
      .filter((q) => q.question && q.options.length > 1); // more than just "I'm not sure"

    if (questions.length === 0) {
      return { ok: false, error: "Couldn't come up with useful questions for this goal. Enter an amount yourself instead." };
    }
    return { ok: true, questions };
  } catch (err) {
    console.error("generateGoalClarifyingQuestions: Anthropic call failed", err);
    return { ok: false, error: "Something went wrong generating questions. Try again, or enter an amount yourself." };
  }
}

export type SuggestGoalSpendCutResult =
  | { ok: true; suggestion: GoalSpendSuggestion }
  | { ok: false; error: string };

// Replaces the old estimateGoalFromAnswers — that one asked Claude to invent
// a per-goal cost BREAKDOWN (e.g. "Gym Protein Powder" turned into whey tub +
// casein + shaker bottles + flavor packs, a shopping list nobody asked for),
// then offered its invented total as something the user could accept in
// place of whatever they'd typed. Two problems: it fabricated line items
// with no basis in reality, and it implied the AI's number was more
// "correct" than the user's own. The user's target amount is authoritative,
// full stop — nothing here computes or suggests a replacement for it.
//
// What this asks for instead is exactly what refreshGoalSuggestions already
// asks for above (same spendCutCandidates/explainSpendCuts pipeline, same
// getGoalCoachSpendingStats data source — deliberately reused, not rebuilt):
// one realistic spending cut, grounded ONLY in the user's REAL category
// spend, with the reduction amount computed in code and only the reasoning
// sentence coming from Claude. The clarifying answers are passed as light
// color for that reasoning sentence (real facts the user tapped — e.g. "a
// one-time purchase" — not AI inventions), never
// as material for a cost breakdown. This is purely informational: nothing it
// returns feeds back into the target amount field.
export async function suggestGoalSpendCut(
  goalName: string,
  answers: ClarifyingAnswer[],
): Promise<SuggestGoalSpendCutResult> {
  const user = await requireUser();
  const name = goalName.trim();
  if (!name) return { ok: false, error: "Give this goal a name first." };

  const history = await getGoalCoachSpendingStats(user.id);
  if (!history.hasEnoughHistory) {
    return { ok: false, error: "Not enough recent spending history yet to base a suggestion on." };
  }

  // Category and suggestedReductionCents are chosen entirely in code — same
  // pipeline as refreshGoalSuggestions above, just capped to a single
  // candidate ahead of goal creation.
  const [picked] = spendCutCandidates(history.categories, 1);
  if (!picked) {
    return {
      ok: false,
      error: "Your spending looks in line with your usual average — nothing specific to flag right now.",
    };
  }

  const answerSummary = answers
    .filter((a) => a.answer && a.answer !== NOT_SURE_OPTION)
    .map((a) => `${a.question} ${a.answer}`)
    .join("; ");

  const reasoningByCategory = await explainSpendCuts(
    answerSummary ? `${name} (${answerSummary})` : name,
    [picked],
  );

  return {
    ok: true,
    suggestion: {
      ...picked,
      reasoning:
        reasoningByCategory[picked.category] ??
        "This is above your recent average — cutting back here could help fund this goal.",
    },
  };
}

// ---------------------------------------------------------------------------
// Split — "Remind via WhatsApp". Sends one real WhatsApp message via
// Twilio's Content API (a pre-approved template, referenced by ContentSid,
// filled in with ContentVariables) when a user explicitly taps the button
// for a participant. NOT a plain Body string: WhatsApp's Business Platform
// requires business-initiated messages to use an approved template —
// sending free text here fails with Twilio error 21654 "ContentSid
// Required" (confirmed live against this account's sandbox), which is what
// this replaces. Fire-and-forget: nothing about the message is stored beyond
// what's needed to send it — no history table, no logged variables/number.
// Same graceful-fallback shape as the Anthropic calls above — missing/unset
// Twilio credentials (including TWILIO_CONTENT_SID_PAYMENT_REMINDER) return a friendly inline
// error, never a crash.
// ---------------------------------------------------------------------------

async function sendWhatsAppMessage(
  toPhoneNumber: string,
  contentVariables: Record<string, string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
  const contentSid = process.env.TWILIO_CONTENT_SID_PAYMENT_REMINDER;

  if (!accountSid || !authToken || !fromNumber || !contentSid) {
    return { ok: false, error: "WhatsApp reminders aren't set up yet." };
  }

  // Twilio's WhatsApp channel prefix, applied exactly once regardless of
  // whether the env var/stored number already carries it — TWILIO_WHATSAPP_NUMBER
  // is commonly copied straight from the Twilio console already as
  // "whatsapp:+1415...", and Contact.phoneNumber is stored in a
  // human-readable display format (e.g. "+65 9123 4567", spaces and all) for
  // its OTHER use as cosmetic PayNow-style display — neither is Twilio's
  // exact expected wire format, so both are normalized here, at the one call
  // site that actually talks to the API, rather than changing what's stored.
  const toE164 = toPhoneNumber.replace(/[^\d+]/g, "");
  const fromE164 = fromNumber.replace(/^whatsapp:/, "");

  // Official SDK (not raw fetch) — reads only from env, credentials never
  // hardcoded. IMPORTANT sandbox limitation: this only reaches numbers that
  // have joined this Twilio sandbox themselves (by sending its specific join
  // phrase, e.g. "join <code-word>", to the sandbox WhatsApp number from
  // their own phone) — a real-world recipient who hasn't done that will
  // simply never receive it, with Twilio still reporting the send as
  // accepted. That's a sandbox/WhatsApp-approval limitation, not a bug here.
  const client = twilio(accountSid, authToken);

  try {
    await client.messages.create({
      from: `whatsapp:${fromE164}`,
      to: `whatsapp:${toE164}`,
      contentSid,
      contentVariables: JSON.stringify(contentVariables),
    });
    return { ok: true };
  } catch (err) {
    // Never log message content or the recipient's number — Twilio's own
    // error code/message are diagnostic metadata, not user content, so
    // those are safe (and necessary) to log for debugging a failed send.
    const twilioErr = err as { status?: unknown; code?: unknown; message?: unknown };
    console.error(
      "sendWhatsAppMessage: Twilio responded",
      twilioErr?.status,
      "code:",
      twilioErr?.code,
      "message:",
      twilioErr?.message,
    );
    return {
      ok: false,
      error: "Couldn't send the reminder. Make sure the recipient has joined the WhatsApp sandbox.",
    };
  }
}

export type SendWhatsAppReminderResult = { ok: true } | { ok: false; error: string };

// Not a useActionState action (no form fields, just an id) — same shape as
// spinSplit/refreshGoalSuggestions: a plain async function the client calls
// directly via useTransition.
export async function sendWhatsAppReminder(
  participantId: string,
): Promise<SendWhatsAppReminderResult> {
  const user = await requireUser();

  // Scoped through split.ownerId — only the split's owner can trigger a
  // reminder for one of its participants; another user's participant id in
  // here is a "not found", not a cross-account send.
  const participant = await prisma.splitParticipant.findFirst({
    where: { id: participantId, split: { ownerId: user.id } },
    include: {
      split: { include: { participants: true } },
      contact: true,
    },
  });
  if (!participant) return { ok: false, error: "Couldn't find that participant." };

  const phoneNumber = participant.contact?.phoneNumber?.trim();
  if (!phoneNumber) {
    return { ok: false, error: "This participant has no saved phone number." };
  }

  // Re-derived server-side (never trust a client-supplied payer/amount for
  // an outbound message) — same payerOf logic Spin to Decide's card uses.
  const payer = participant.split.payerParticipantId
    ? participant.split.participants.find((p) => p.id === participant.split.payerParticipantId)
    : null;
  if (!payer) {
    return { ok: false, error: "Spin to Decide hasn't picked a payer for this split yet." };
  }
  if (payer.id === participant.id) {
    return { ok: false, error: "This participant fronted the bill — nothing to remind them of." };
  }

  // Keyed "1", "2", "3" matching the {{1}}, {{2}}, {{3}} placeholders in the
  // approved Content Template (Twilio Console → Content Editor): participant
  // name, amount owed (their share), split description/merchant. Order and
  // count must match that template's actual variables exactly, since Twilio
  // has no way to check this against the template shape ahead of send time.
  const contentVariables: Record<string, string> = {
    "1": participant.name,
    "2": formatMoney(participant.shareAmountCents),
    "3": participant.split.title,
  };

  return sendWhatsAppMessage(phoneNumber, contentVariables);
}

// ---------------------------------------------------------------------------
// Rewards Marketplace — "AI Deal Finder". Discovery/recommendation only: it
// finds and ranks real search results, it NEVER executes a real booking,
// payment, or checkout — "Authorise & Pay with NETS" on a result routes
// through the exact same makePayment Server Action Scan & Pay uses (see
// AiDealFinder.tsx / DealCheckout.tsx), never a second payment path.
//
// Pipeline: user request -> analyzeSearchIntent (Claude, structured extract
// + deterministic clarify gate) -> [mini-chat clarification loop, client
// side] -> findDeals (Exa live search -> extract -> Claude scoring) -> show
// deals -> source link -> NETS payment simulation. Two Server Actions, not a
// multi-file "agent" system: findDeals still does Planning (deterministic),
// Researching (real Exa call), and Scoring (real Claude call) in a straight
// line, same as before — see AiDealFinder.tsx's comment on how stage timing
// works. analyzeSearchIntent is the new step in front of it.
//
// Requires ANTHROPIC_API_KEY (both actions) and, for findDeals, EXA_API_KEY
// too. Checked upfront (fail fast with one clear message) rather than
// partway through the pipeline — same graceful-fallback shape as every
// other Claude call in this app.
// ---------------------------------------------------------------------------

// Never loop the clarification chat forever — after this many rounds, search
// with whatever's known rather than asking indefinitely. "Minimum number of
// questions" cuts both ways: it also means never getting stuck.
const MAX_CLARIFYING_TURNS = 3;

// No category-specific fields anywhere in this schema — Claude decides, per
// request, which slots are even relevant (see dealFinder.ts's comment on
// SearchIntent). The one thing NOT left to the model's own judgment is
// whether to search yet: analyzeSearchIntent below derives that
// deterministically from `critical` + `status`, via hasUnresolvedCriticalSlot.
const ANALYZE_INTENT_TOOL: Anthropic.Tool = {
  name: "analyze_intent",
  description:
    "Extract structured search intent from a user's deal-finding request (and any clarifying answers so far), tagging every field's provenance honestly.",
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description:
          "A short freeform category label for what's being searched, e.g. 'flights', 'hotels', 'electronics', 'food', 'shopping', 'experiences' — or another label that fits. Chosen dynamically, not from a fixed list.",
      },
      slots: {
        type: "array",
        description:
          "Every piece of information relevant to searching THIS specific request well. Decide which slots matter yourself — do not reuse the same fixed template across categories (e.g. don't always ask flights for origin, hotels for guests, shoes for size — only include a slot if it's genuinely relevant here).",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "short slot name, e.g. 'origin', 'destination', 'travel_dates', 'budget', 'quantity', 'size', 'preferences'",
            },
            value: {
              type: ["string", "null"],
              description: "the extracted value in the user's own terms, or null if UNKNOWN",
            },
            status: {
              type: "string",
              enum: ["EXPLICIT", "INFERRED", "UNKNOWN"],
              description:
                "EXPLICIT only if the user actually stated it (anywhere in the request or the clarifying answers given so far). INFERRED only for a safe, low-risk default reasonably implied by context (e.g. quantity=1 when ordering a single item and none was stated) — never a specific place, date, or price. UNKNOWN otherwise. NEVER invent a specific value just to avoid UNKNOWN.",
            },
            critical: {
              type: "boolean",
              description:
                "true only if this slot being unknown would make search results likely wrong or irrelevant for THIS specific request (e.g. flight origin is critical; a preferred shoe color usually is not).",
            },
          },
          required: ["name", "status", "critical"],
        },
      },
      clarifyingQuestion: {
        type: ["string", "null"],
        description:
          "If any slot is critical AND unknown, ONE short natural question resolving the single highest-priority missing critical slot. Null if nothing critical is missing.",
      },
      quickReplies: {
        type: "array",
        items: { type: "string" },
        description: "2-4 short tap-able example answers for clarifyingQuestion. Empty array if clarifyingQuestion is null.",
      },
    },
    required: ["category", "slots", "clarifyingQuestion", "quickReplies"],
  },
};

export type AnalyzeIntentResult = { ok: true; intent: SearchIntent } | { ok: false; error: string };

// Called once per turn of the mini-clarification chat (see AiDealFinder.tsx)
// — first with an empty `turns`, then again with the growing conversation
// each time the user answers, until readyToSearch. Stateless: the full
// conversation is re-sent and re-parsed every time, so a single free-text
// answer covering several slots at once (e.g. "Singapore, 2 people, under
// $700") gets fully extracted in one round rather than requiring one
// question per slot.
export async function analyzeSearchIntent(
  query: string,
  turns: ClarifyTurn[],
): Promise<AnalyzeIntentResult> {
  await requireUser();

  const trimmed = query.trim();
  if (!trimmed) return { ok: false, error: "Type what you're looking for first." };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "Deal search isn't set up yet." };
  }

  if (turns.length >= MAX_CLARIFYING_TURNS) {
    return {
      ok: true,
      intent: { category: "", slots: [], readyToSearch: true, clarifyingQuestion: null, quickReplies: [] },
    };
  }

  const conversation = turns.length
    ? `\n\nClarifying answers so far:\n${turns.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join("\n")}`
    : "";

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 700,
      tools: [ANALYZE_INTENT_TOOL],
      tool_choice: { type: "tool", name: "analyze_intent" },
      messages: [
        {
          role: "user",
          content: `A user is searching an AI Deal Finder for real deals (flights, hotels, electronics, food, shopping, experiences, etc). Their original request: "${trimmed}"${conversation}\n\nExtract every slot of information relevant to searching THIS specific request well. For each, tag EXPLICIT/INFERRED/UNKNOWN honestly — never invent a specific value (a city, a date, a number) just to fill a slot. Mark a slot critical only if searching without it would likely produce results that are WRONG or IRRELEVANT, not merely less precise — e.g. a flight origin is critical if missing entirely, but once the user has given a reasonably usable answer (a month like "December" for dates, a city name for a location, an approximate budget), that slot is resolved and must NOT be marked critical/UNKNOWN just to press for more precision (exact days, a specific airport, an exact dollar figure). Be conservative: only ask again if something is genuinely missing, not to refine what's already usable. If any critical slot is UNKNOWN, ask exactly ONE short clarifying question about the single highest-priority missing one, with 2-4 short quick-reply suggestions. If nothing critical is missing, leave clarifyingQuestion null and quickReplies empty. Call analyze_intent.`,
        },
      ],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { ok: false, error: "Couldn't understand that search. Try rephrasing." };
    }

    const input = toolUse.input as {
      category?: unknown;
      slots?: Array<{ name?: unknown; value?: unknown; status?: unknown; critical?: unknown }>;
      clarifyingQuestion?: unknown;
      quickReplies?: unknown;
    };

    const slots: IntentSlot[] = (Array.isArray(input.slots) ? input.slots : [])
      .map((s) => {
        const status: FieldStatus =
          s?.status === "EXPLICIT" || s?.status === "INFERRED" ? s.status : "UNKNOWN";
        return {
          name: String(s?.name ?? "").trim(),
          value: typeof s?.value === "string" && s.value.trim() ? s.value.trim() : null,
          status,
          critical: Boolean(s?.critical),
        };
      })
      .filter((s) => s.name);

    // The gate is code, not the model's own claim — see hasUnresolvedCriticalSlot.
    const readyToSearch = !hasUnresolvedCriticalSlot(slots);
    const firstMissing = slots.find((s) => s.critical && s.status === "UNKNOWN");
    const clarifyingQuestion = readyToSearch
      ? null
      : (typeof input.clarifyingQuestion === "string" && input.clarifyingQuestion.trim()) ||
        (firstMissing ? `Could you tell me the ${firstMissing.name.replace(/_/g, " ")}?` : null);
    const quickReplies = readyToSearch
      ? []
      : Array.isArray(input.quickReplies)
        ? input.quickReplies
            .map((q) => String(q ?? "").trim())
            .filter(Boolean)
            .slice(0, 4)
        : [];

    return {
      ok: true,
      intent: {
        category: String(input.category ?? "").trim(),
        slots,
        readyToSearch,
        clarifyingQuestion,
        quickReplies,
      },
    };
  } catch (err) {
    console.error("analyzeSearchIntent: Anthropic call failed", err);
    return { ok: false, error: "Something went wrong understanding that search. Try again shortly." };
  }
}

// Category-appropriate factors Claude names itself per result (never a fixed
// Value/Speed/Quality triple — see dealFinder.ts's comment on DealFactor). A
// factor the listing text doesn't actually support is marked unavailable,
// never guessed.
const SCORE_RESULTS_TOOL: Anthropic.Tool = {
  name: "score_results",
  description:
    "Pick and score the best 3-5 of the given REAL search results for a user's query, using category-appropriate factors grounded only in the evidence given — never invented.",
  input_schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: {
              type: "number",
              description: "0-based index into the numbered candidate list provided",
            },
            dealScore: {
              type: "number",
              description: "0-100 overall evidence-based deal score for this result",
            },
            factors: {
              type: "array",
              minItems: 2,
              maxItems: 4,
              description:
                "2-4 factors that actually matter for THIS kind of result — choose the names yourself based on what this is (e.g. flights: price, stops, duration, fare type; electronics: price, discount, specs match; hotels: price, location, rating, amenities; food/experiences: price, rating, convenience). Never use generic Value/Speed/Quality labels.",
              items: {
                type: "object",
                properties: {
                  label: { type: "string", description: "short factor name specific to this category, e.g. 'Price', 'Stops', 'Rating'" },
                  score: { type: ["number", "null"], description: "0-100, or null if `available` is false" },
                  available: {
                    type: "boolean",
                    description:
                      "false if the listing text does not actually contain the data this factor needs (e.g. no rating shown) — in that case score must be null. Never guess a score for missing data.",
                  },
                },
                required: ["label", "available"],
              },
            },
            why: {
              type: "string",
              description:
                "One short sentence explaining the ranking, citing ONLY facts present in the listing text given — never invented reasoning.",
            },
          },
          required: ["index", "dealScore", "factors", "why"],
        },
      },
    },
    required: ["results"],
  },
};

export type FindDealsState = { ok: true; results: RankedDeal[] } | { ok: false; error: string };

export async function findDeals(
  query: string,
  turns: ClarifyTurn[],
  filters: { maxBudgetCents: number | null },
): Promise<FindDealsState> {
  await requireUser();

  const trimmed = query.trim();
  if (!trimmed) return { ok: false, error: "Type what you're looking for first." };
  if (trimmed.length > 200) return { ok: false, error: "That's a bit long — try a shorter search." };

  if (!process.env.EXA_API_KEY || !process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "Deal search isn't set up yet." };
  }

  // --- Stage 1: Planning (deterministic, no API call) ---------------------
  // The actual text sent to Exa is the user's own words — the original
  // request plus every clarifying answer they gave, in order — never a
  // paraphrase reconstructed by Claude. This is what actually fixes the
  // "assumed origin" bug: once the user has answered "where are you flying
  // from?", that answer is literally part of the search text sent to Exa,
  // not just recorded and ignored. Budget, if set, is appended the same way
  // it always was.
  const answerText = turns
    .map((t) => t.answer.trim())
    .filter(Boolean)
    .join(". ");
  const baseQuery = answerText ? `${trimmed}. ${answerText}` : trimmed;
  const searchQuery = filters.maxBudgetCents
    ? `${baseQuery} under $${Math.round(filters.maxBudgetCents / 100)}`
    : baseQuery;

  // --- Stage 2: Researching (real: Exa live web search) --------------------
  let exaResults: Array<{ title: string; url: string; text: string }>;
  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "x-api-key": process.env.EXA_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: searchQuery,
        numResults: 8,
        type: "neural",
        contents: { text: true },
      }),
    });
    if (!res.ok) {
      console.error("findDeals: Exa responded", res.status);
      return { ok: false, error: "Deal search is temporarily unavailable. Try again shortly." };
    }
    const data = (await res.json()) as {
      results?: Array<{ title?: unknown; url?: unknown; text?: unknown }>;
    };
    exaResults = (Array.isArray(data.results) ? data.results : [])
      .map((r) => ({
        title: String(r?.title ?? "").trim(),
        url: String(r?.url ?? "").trim(),
        text: String(r?.text ?? "").trim(),
      }))
      .filter((r) => r.title && r.url);
  } catch (err) {
    console.error("findDeals: Exa call failed", err);
    return { ok: false, error: "Deal search is temporarily unavailable. Try again shortly." };
  }

  if (exaResults.length === 0) {
    return { ok: false, error: "No results found for that search. Try rephrasing." };
  }

  // Deterministic candidate prep, still part of "planning" logic: extract a
  // real price from the result text (never invented — see
  // dealFinder.ts), then hard-filter by budget. Only candidates with a
  // KNOWN price over budget are dropped; an unpriced listing isn't excluded
  // just because we couldn't read a number out of its snippet.
  const candidates = exaResults
    .map((r) => ({ ...r, priceCents: extractPriceCents(r.text || r.title) }))
    .filter(
      (c) =>
        filters.maxBudgetCents == null || c.priceCents == null || c.priceCents <= filters.maxBudgetCents,
    )
    .slice(0, 8);

  if (candidates.length === 0) {
    return { ok: false, error: "No results matched your budget. Try raising it or rephrasing." };
  }

  // --- Stage 3: Scoring (real: Claude, given the REAL Exa results) --------
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const candidateList = candidates
      .map(
        (c, i) =>
          `${i}. ${c.title} — ${c.priceCents != null ? formatMoney(c.priceCents) : "price not listed"}\n${c.text.slice(0, 400)}`,
      )
      .join("\n\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      tools: [SCORE_RESULTS_TOOL],
      tool_choice: { type: "tool", name: "score_results" },
      messages: [
        {
          role: "user",
          content: `A user searched: "${trimmed}"${answerText ? ` (${answerText})` : ""}${filters.maxBudgetCents ? ` with a budget under ${formatMoney(filters.maxBudgetCents)}` : ""}. Here are REAL live web search results for that query:\n\n${candidateList}\n\nPick the best 3-5 of these candidates by index. For each, give an overall 0-100 dealScore reflecting how good a deal it genuinely is based on the evidence, plus 2-4 factors specific to this category of result (never generic Value/Speed/Quality — pick factor names that actually fit, e.g. price/stops/duration for flights, price/discount/specs for electronics, price/location/rating for hotels). Only score a factor if the listing text actually supports it — otherwise mark it unavailable rather than guessing. One short sentence of "why" citing only facts actually present in the listing text. Use ONLY the candidates listed above by their index — don't invent new ones, and don't invent a price different from what's shown for each. Call score_results.`,
        },
      ],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return { ok: false, error: "Couldn't rank results for that search. Try rephrasing." };
    }

    const input = toolUse.input as {
      results?: Array<{
        index?: unknown;
        dealScore?: unknown;
        factors?: Array<{ label?: unknown; score?: unknown; available?: unknown }>;
        why?: unknown;
      }>;
    };

    const scored: RankedDeal[] = (Array.isArray(input.results) ? input.results : [])
      .map((r) => {
        const idx = Math.round(Number(r?.index));
        const candidate = candidates[idx];
        if (!candidate) return null;
        const factors: DealFactor[] = (Array.isArray(r?.factors) ? r.factors : [])
          .map((f) => {
            const available = Boolean(f?.available);
            return {
              label: String(f?.label ?? "").trim(),
              available,
              // A factor marked unavailable never gets a score, even if the
              // model supplied one — never guessed data reaching the UI.
              score: available ? clampScore(f?.score) : null,
            };
          })
          .filter((f) => f.label)
          .slice(0, 4);
        const deal: RankedDeal = {
          title: candidate.title,
          url: candidate.url,
          priceCents: candidate.priceCents,
          snippet: candidate.text.slice(0, 200),
          dealScore: clampScore(r?.dealScore),
          factors,
          why: String(r?.why ?? "").trim() || "Recommended based on your search.",
        };
        return deal;
      })
      .filter((r): r is RankedDeal => r !== null)
      .sort((a, b) => b.dealScore - a.dealScore)
      .slice(0, 5);

    if (scored.length === 0) {
      return { ok: false, error: "Couldn't rank results for that search. Try rephrasing." };
    }
    return { ok: true, results: scored };
  } catch (err) {
    console.error("findDeals: Anthropic call failed", err);
    return { ok: false, error: "Something went wrong ranking results. Try again shortly." };
  }
}
