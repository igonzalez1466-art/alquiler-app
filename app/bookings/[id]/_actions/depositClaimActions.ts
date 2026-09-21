"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { claimReasons, readDepositClaim, parseClaimAmount, claimSettlement, type DepositClaim } from "@/app/lib/depositClaim";
import { getDepositDecisionDeadline } from "@/app/lib/depositAutoReleasePolicy";
import { readIssue, hasReturnReceipt } from "@/app/lib/logisticsIssue";
import { releaseDepositAction, partialReleaseDepositAction, retainDepositAction, retrySettlementAction } from "./depositActions";

async function actor() {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) throw new Error("Brak dostępu");
  return session.user.id;
}
function bookingId(data: FormData) {
  const id = String(data.get("bookingId") || "");
  if (!id) throw new Error("Brak rezerwacji");
  return id;
}
function refresh(id: string) {
  revalidatePath("/bookings/" + id);
  revalidatePath("/bookings");
  revalidatePath("/admin/deposit-claims");
}
async function lock(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${id} FOR UPDATE`;
  return tx.booking.findUniqueOrThrow({ where: { id } });
}

export async function proposeDepositClaimAction(data: FormData) {
  const userId = await actor(), id = bookingId(data);
  const retainedCents = parseClaimAmount(data.get("retainedAmountZl"));
  const reason = String(data.get("reason") || "").trim();
  const reasonCode = String(data.get("reasonCode") || "");
  if (!Object.hasOwn(claimReasons, reasonCode) || !reason || reason.length > 2000 || retainedCents <= 0) {
    throw new Error("Podaj kwotę, powód i opis (do 2000 znaków).");
  }
  await prisma.$transaction(async tx => {
    const b = await lock(tx, id);
    if (b.ownerId !== userId || b.ownerId === b.renterId) throw new Error("Brak uprawnień");
    if (b.status === "CANCELLED" || b.cancelledAt || b.paymentStatus !== "PAID" ||
      b.depositStatus !== "PAID" || !b.depositCents || retainedCents > b.depositCents ||
      b.depositClaim !== null || b.settlementDecision !== null || b.settlementCompletedAt ||
      b.settlementLegacyReview || b.depositDecisionAt || b.depositRefundId || b.depositTransferId ||
      (b.depositRefundedCents ?? 0) > 0 || (b.depositRetainedCents ?? 0) > 0 ||
      !["CONFIRMED", "AUTO_CONFIRMED"].includes(b.deliveryConfirmationStatus) ||
      !["SHIPPED", "DELIVERED"].includes(b.returnStatus)) throw new Error("Nie można teraz utworzyć roszczenia.");
    if (!hasReturnReceipt(b) && data.get("received") !== "yes") throw new Error("Potwierdź faktyczny odbiór zwracanego przedmiotu.");
    const deadline = getDepositDecisionDeadline(b.returnConfirmedAt);
    if (deadline && deadline <= new Date()) throw new Error("Termin zgłoszenia roszczenia upłynął.");
    if (await tx.settlementOperation.findFirst({ where: { bookingId: id }, select: { id: true } })) {
      throw new Error("Rozliczenie zostało już rozpoczęte.");
    }
    const now = new Date();
    const claim: DepositClaim = {
      id: randomUUID(), status: "PENDING", proposedById: userId, proposedAt: now.toISOString(),
      retainedCents, reasonCode: reasonCode as DepositClaim["reasonCode"], reason,
      renterResponse: null, respondedAt: null, approvedById: null, approvedAt: null,
      approvedRetainedCents: null, resolutionSource: null, resolutionNote: null,
    };
    await tx.booking.update({ where: { id }, data: {
      depositClaim: claim, damageClaimStatus: "OPEN",
      returnStatus: "DELIVERED", returnDeliveredAt: b.returnDeliveredAt ?? now,
      returnConfirmationStatus: "DISPUTED", returnConfirmBy: null,
    } });
  });
  refresh(id);
}

export async function respondDepositClaimAction(data: FormData) {
  const userId = await actor(), id = bookingId(data);
  const response = String(data.get("response") || "");
  const note = String(data.get("note") || "").trim();
  if (!["ACCEPT", "DISPUTE"].includes(response)) throw new Error("Wybierz odpowiedź.");
  if (response === "ACCEPT" && data.get("consent") !== "yes") throw new Error("Potwierdź zgodę na wskazaną kwotę potrącenia.");
  if (response === "DISPUTE" && (!note || note.length > 2000)) throw new Error("Opisz, dlaczego nie zgadzasz się z roszczeniem (do 2000 znaków).");
  await prisma.$transaction(async tx => {
    const b = await lock(tx, id), c = readDepositClaim(b.depositClaim);
    if (b.renterId !== userId || b.ownerId === userId || !c || c.status !== "PENDING" || c.id !== data.get("claimId")) throw new Error("Roszczenie nie jest dostępne do odpowiedzi.");
    if (b.status === "CANCELLED" || b.cancelledAt || b.paymentStatus !== "PAID" || b.depositStatus !== "PAID" || b.settlementDecision !== null || b.settlementCompletedAt) throw new Error("Stan rezerwacji uległ zmianie.");
    const now = new Date();
    if (response === "DISPUTE") {
      await tx.booking.update({ where: { id }, data: { depositClaim: { ...c, status: "DISPUTED", renterResponse: note, respondedAt: now.toISOString() } } });
    } else {
      await approve(tx, b, { ...c, status: "APPROVED", respondedAt: now.toISOString(), approvedAt: now.toISOString(), approvedById: userId, approvedRetainedCents: c.retainedCents, resolutionSource: "RENTER" }, now);
    }
  });
  refresh(id);
}

async function approve(tx: Prisma.TransactionClient, b: Awaited<ReturnType<typeof lock>>, claim: DepositClaim, now: Date) {
  const issue = readIssue(b.returnIssue);
  await tx.booking.update({ where: { id: b.id }, data: {
    depositClaim: claim, damageClaimStatus: "RESOLVED",
    returnConfirmationStatus: "CONFIRMED", returnConfirmedAt: b.returnConfirmedAt ?? now,
    returnConfirmedBy: "OWNER", returnConfirmBy: null,
    ...(issue ? { returnIssue: { ...issue, resolvedAt: now.toISOString(), resolvedById: claim.approvedById } } : {}),
  } });
}

export async function resolveDepositClaimBySupportAction(data: FormData) {
  const userId = await actor(), id = bookingId(data);
  const retainedCents = parseClaimAmount(data.get("retainedAmountZl"));
  const note = String(data.get("note") || "").trim();
  if (!note || note.length > 2000 || data.get("consent") !== "yes") throw new Error("Podaj uzasadnienie i potwierdź decyzję.");
  await prisma.$transaction(async tx => {
    const staff = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (staff?.role !== "ADMIN") throw new Error("Brak uprawnień");
    const b = await lock(tx, id), c = readDepositClaim(b.depositClaim);
    if (b.ownerId === userId || b.renterId === userId) throw new Error("Nie możesz rozstrzygać własnej rezerwacji.");
    if (!c || c.status !== "DISPUTED" || c.id !== data.get("claimId") || retainedCents > c.retainedCents ||
      b.status === "CANCELLED" || b.cancelledAt || b.paymentStatus !== "PAID" || b.depositStatus !== "PAID" ||
      b.settlementDecision !== null || b.settlementCompletedAt) throw new Error("Nie można rozstrzygnąć tego roszczenia.");
    const now = new Date();
    await approve(tx, b, { ...c, status: "APPROVED", approvedById: userId, approvedAt: now.toISOString(), approvedRetainedCents: retainedCents, resolutionSource: "SUPPORT", resolutionNote: note }, now);
  });
  refresh(id);
}

export async function executeApprovedClaimAction(data: FormData) {
  const userId = await actor(), id = bookingId(data);
  const b = await prisma.booking.findUniqueOrThrow({ where: { id } });
  if (![b.ownerId, b.renterId].includes(userId)) {
    const staff = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (staff?.role !== "ADMIN") throw new Error("Brak uprawnień");
  }
  const c = readDepositClaim(b.depositClaim);
  if (!c || c.status !== "APPROVED" || c.id !== data.get("claimId")) throw new Error("Brak zatwierdzonego roszczenia.");
  if (b.settlementCompletedAt) return;
  const form = new FormData(); form.set("bookingId", id);
  if (b.settlementDecision) await retrySettlementAction(form);
  else {
    const decision = claimSettlement(c, b.depositCents ?? 0);
    form.set("refundAmountZl", (decision.refundCents / 100).toFixed(2));
    form.set("reason", decision.reason ?? ""); form.set("reasonCode", decision.reasonCode ?? "");
    if (decision.kind === "full") await releaseDepositAction(form);
    else if (decision.kind === "partial") await partialReleaseDepositAction(form);
    else await retainDepositAction(form);
  }
  refresh(id);
}
