"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { pointsForSpendCents } from "@/lib/rewards";
import { startOfThisMonth } from "@/lib/data/queries";

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

  const [bill, account] = await Promise.all([
    prisma.recurringBill.findFirst({ where: { id: billId, userId: user.id } }),
    prisma.account.findUnique({ where: { userId: user.id } }),
  ]);
  if (!bill || !account) return { ok: false, error: "Something went wrong. Try again." };

  // Same "already covered this cycle" rule the Bills page uses to hide the
  // Pay button (getSpendingPlan uses it too) — enforced server-side so a
  // double-click or a slow-network double-submit can't charge the bill twice.
  if (bill.lastPaidAt && bill.lastPaidAt >= startOfThisMonth()) {
    return { ok: false, error: "This bill is already paid for this month." };
  }

  if (account.balanceCents < bill.amountCents) {
    return { ok: false, error: "Insufficient balance to pay this bill." };
  }

  await prisma.$transaction([
    prisma.account.update({
      where: { userId: user.id },
      data: {
        balanceCents: { decrement: bill.amountCents },
        rewardPoints: { increment: pointsForSpendCents(bill.amountCents) },
      },
    }),
    prisma.transaction.create({
      data: {
        userId: user.id,
        description: bill.name,
        category: bill.category,
        amountCents: -bill.amountCents,
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
