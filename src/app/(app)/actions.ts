"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
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
import { getMonthlyQualifyingPaymentCount, startOfThisMonth } from "@/lib/data/queries";

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

  let participants: Array<{ name: string; shareAmountCents: number }>;
  try {
    participants = JSON.parse(String(formData.get("participants") ?? "[]"));
  } catch {
    return { ok: false };
  }
  if (!Array.isArray(participants) || participants.length === 0) return { ok: false };

  const cleaned = participants
    .map((p) => ({ name: String(p?.name ?? "").trim(), shareAmountCents: Math.round(Number(p?.shareAmountCents)) }))
    .filter((p) => p.name && Number.isFinite(p.shareAmountCents) && p.shareAmountCents >= 0);
  if (cleaned.length === 0) return { ok: false };

  // Shares must add up to the total — reject on tamper/rounding bugs,
  // consistent with this file's existing minimal-validation style.
  const sum = cleaned.reduce((s, p) => s + p.shareAmountCents, 0);
  if (sum !== totalAmountCents) return { ok: false };

  await prisma.split.create({
    data: {
      ownerId: user.id,
      title,
      totalAmountCents,
      category,
      participants: { create: cleaned.map((p) => ({ name: p.name, shareAmountCents: p.shareAmountCents })) },
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

  await prisma.$transaction([
    prisma.account.update({
      where: { userId: user.id },
      data: {
        balanceCents: { decrement: chargeCents },
        // One net movement so earn and spend settle atomically together.
        rewardPoints: { increment: pointsEarned - pointsSpent },
      },
    }),
    prisma.transaction.create({
      data: {
        userId: user.id,
        description: bill.name,
        category: bill.category,
        amountCents: -chargeCents,
        type: "BILL",
      },
    }),
    prisma.recurringBill.update({
      where: { id: bill.id },
      data: { lastPaidAt: new Date() },
    }),
  ]);

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
    return { ok: false, error: "Enter how many points to redeem." };
  }

  // Redeem in whole dollars — i.e. whole multiples of 100 points.
  const points =
    Math.floor(requested / POINTS_PER_DOLLAR_REDEEMED) * POINTS_PER_DOLLAR_REDEEMED;
  if (points <= 0) {
    return { ok: false, error: `Redeem at least ${POINTS_PER_DOLLAR_REDEEMED} points ($1.00).` };
  }

  const account = await prisma.account.findUnique({ where: { userId: user.id } });
  if (!account) return { ok: false, error: "Something went wrong. Try again." };
  if (account.rewardPoints < points) {
    return { ok: false, error: "You don't have enough points for that." };
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
