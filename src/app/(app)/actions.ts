"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { recordNetsPayment } from "@/lib/rewards";
import { startOfThisMonth } from "@/lib/data/queries";

// All of these are SIMULATED money movements — they only write rows to Postgres
// via Prisma. No real payment processing.

// Thrown inside a prisma.$transaction to roll the whole thing back while
// carrying a user-facing reason out to the caller. Every throw site below is a
// guard that only trips on a race, so the message is the useful part.
class ActionAbort extends Error {}

// Turns a rolled-back transaction into the {ok, error} shape the forms already
// render. An ActionAbort message is deliberate and safe to show; anything else
// is a real fault — log it rather than swallowing it, and show a generic line.
function failed(err: unknown, context: string): { ok: false; error: string } {
  if (err instanceof ActionAbort) return { ok: false, error: err.message };
  console.error(`${context} failed`, err);
  return { ok: false, error: "Something went wrong. Try again." };
}

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

  const monthStart = startOfThisMonth();

  // Read-time checks, so the two expected failures get a specific message.
  // They are NOT what makes this safe — the conditional write below is.
  if (bill.lastPaidAt && bill.lastPaidAt >= monthStart) {
    return { ok: false, error: "This bill is already paid for this month." };
  }
  if (account.balanceCents < bill.amountCents) {
    return { ok: false, error: "Insufficient balance to pay this bill." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Claim the cycle FIRST, conditionally — the same "already covered this
      // cycle" rule as above, but re-checked inside the transaction where the
      // row is locked. Two rapid submissions both pass the read above; only one
      // gets count 1 here, and the loser rolls back before any money moves or
      // points are credited. Without this the bill is charged twice AND the
      // points are awarded twice, and nothing re-derives rewardPoints from the
      // ledger later, so the extra points would be permanent.
      const claimed = await tx.recurringBill.updateMany({
        where: {
          id: bill.id,
          userId: user.id,
          OR: [{ lastPaidAt: null }, { lastPaidAt: { lt: monthStart } }],
        },
        data: { lastPaidAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new ActionAbort("This bill is already paid for this month.");
      }

      // Debit + ledger row + points, together. See recordNetsPayment.
      await recordNetsPayment(tx, {
        userId: user.id,
        description: bill.name,
        category: bill.category,
        amountCents: bill.amountCents,
        type: "BILL",
      });
    });
  } catch (err) {
    return failed(err, "payBill");
  }

  revalidatePath("/bills");
  revalidatePath("/home");
  // Points and the ledger row both changed — /rewards reads the balance, the
  // tier count and the earn history; /transactions lists the new row.
  revalidatePath("/rewards");
  revalidatePath("/transactions");
  return { ok: true };
}

// Shaped as (prevState, formData) => State (same pattern as payBill) so the
// Redeem button can show why a redemption failed. It used to return silently
// on insufficient points, which looked like a dead button.
export type RedeemRewardState = { ok: boolean; error?: string } | null;

export async function redeemReward(
  _prev: RedeemRewardState,
  formData: FormData,
): Promise<RedeemRewardState> {
  const user = await requireUser();
  const rewardId = String(formData.get("rewardId") ?? "");
  if (!rewardId) return { ok: false, error: "Something went wrong. Try again." };

  const [account, reward] = await Promise.all([
    prisma.account.findUnique({ where: { userId: user.id } }),
    prisma.reward.findUnique({ where: { id: rewardId } }),
  ]);
  if (!account) return { ok: false, error: "Something went wrong. Try again." };
  if (!reward) return { ok: false, error: "That reward is no longer available." };

  // Read-time check for the message that actually helps — name the shortfall
  // rather than just refusing. The conditional decrement below is the guard.
  if (account.rewardPoints < reward.pointCost) {
    return {
      ok: false,
      error: `Not enough points — ${reward.name} costs ${reward.pointCost.toLocaleString()} pts and you have ${account.rewardPoints.toLocaleString()}.`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Conditional decrement: `rewardPoints >= pointCost` lives in the WHERE,
      // so Postgres re-evaluates it against the committed row after locking it.
      // Two submissions racing off the same stale balance can't both win, which
      // is what keeps rewardPoints from ever going negative — a plain
      // read-then-decrement would let the second one underflow.
      const debited = await tx.account.updateMany({
        where: { userId: user.id, rewardPoints: { gte: reward.pointCost } },
        data: { rewardPoints: { decrement: reward.pointCost } },
      });
      if (debited.count === 0) {
        throw new ActionAbort(
          "Your point balance just changed — refresh and try redeeming again.",
        );
      }

      await tx.redemption.create({
        data: {
          userId: user.id,
          rewardId: reward.id,
          pointsSpent: reward.pointCost,
        },
      });

      // $0 ledger row so a redemption is visible in Transactions too; txnValue()
      // renders REWARD rows as "Redeemed" instead of a "+$0.00" that would read
      // like a bug in a money ledger (src/lib/txn.ts).
      await tx.transaction.create({
        data: {
          userId: user.id,
          description: `Redeemed: ${reward.name}`,
          category: "Rewards",
          amountCents: 0,
          type: "REWARD",
        },
      });
    });
  } catch (err) {
    return failed(err, "redeemReward");
  }

  revalidatePath("/rewards");
  revalidatePath("/home");
  revalidatePath("/transactions");
  return { ok: true };
}

// Powers the Pay flow's confirm step. Same balance+points+transaction write
// as payBill (via recordNetsPayment, one prisma.$transaction), but on
// success it redirects straight to the receipt page rather than returning
// {ok:true} — there's no form left on screen to show a success state on,
// the whole point is to navigate to Payment Successful.
export type MakePaymentState = { ok: boolean; error?: string } | null;

export async function makePayment(
  _prev: MakePaymentState,
  formData: FormData,
): Promise<MakePaymentState> {
  const user = await requireUser();
  const merchant = String(formData.get("merchant") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || "Shopping";
  const amountCents = Math.round(Number(formData.get("amount")) * 100);

  if (!merchant) return { ok: false, error: "Something went wrong. Try again." };
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Enter an amount greater than $0." };
  }

  const account = await prisma.account.findUnique({ where: { userId: user.id } });
  if (!account) return { ok: false, error: "Something went wrong. Try again." };

  // Same insufficient-balance message style as payBill.
  if (account.balanceCents < amountCents) {
    return { ok: false, error: "Insufficient balance to complete this payment." };
  }

  let transactionId: string;
  try {
    const result = await prisma.$transaction((tx) =>
      recordNetsPayment(tx, {
        userId: user.id,
        description: merchant,
        category,
        amountCents,
        type: "PAYMENT",
      }),
    );
    transactionId = result.transactionId;
  } catch (err) {
    return failed(err, "makePayment");
  }

  revalidatePath("/home");
  revalidatePath("/rewards");
  revalidatePath("/transactions");
  redirect(`/pay/success/${transactionId}`);
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
