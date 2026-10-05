import type { Booking } from "@prisma/client";
import { canActOnIncident } from "@/app/lib/incidentPolicy";
import { canReceive } from "@/app/lib/logistics";
import { readDepositClaim } from "@/app/lib/depositClaim";
import { readIssue } from "@/app/lib/logisticsIssue";
import { getApprovalDeadline } from "@/app/lib/approvalExpiry";
import { isPaymentDeadlineExpired } from "@/app/lib/paymentDeadline";
import { getDepositDecisionDeadline } from "@/app/lib/depositAutoReleasePolicy";
import { DEPOSITS_ENABLED } from "@/app/lib/features";
export type PendingTask = { id: string; bookingNumber: number | null; listing: string | null; title: string; description: string; href: string; deadline: string | null; priority: number };
export type TaskBooking = Pick<Booking, "id" | "bookingNumber" | "ownerId" | "renterId" | "status" | "paymentStatus" | "paymentDueAt" | "createdAt" | "startDate" | "endDate" | "cancelledAt" | "shippingStatus" | "deliveryConfirmationStatus" | "returnStatus" | "returnConfirmationStatus" | "returnConfirmedAt" | "depositStatus" | "depositCents" | "depositClaim" | "settlementDecision" | "settlementCompletedAt" | "deliveryIssue" | "returnIssue" | "settlementLegacyReview" | "depositDecisionAt"> & { incidents?: { stage: string; status: string }[]; listing: { title: string } };
export function bookingTask(b: TaskBooking, userId: string, now = new Date()): PendingTask | null {
  const owner = b.ownerId === userId, renter = b.renterId === userId;
  if ((!owner && !renter) || b.status === "CANCELLED" || b.cancelledAt) return null;
  if (b.settlementCompletedAt && (b.depositCents ?? 0) > 0) return null;
  const task = (kind: string, title: string, description: string, priority = 2, deadline: Date | null = null): PendingTask => ({
    id: `${b.id}:${kind}`, bookingNumber: b.bookingNumber, listing: b.listing.title, title, description,
    href: ["claim", "settle", "deliveryIssue", "deliveryIssueOwner", "returnIssue", "returnIssueRenter"].includes(kind) ||
      (["deposit", "retry"].includes(kind) && (b.returnIssue !== null || b.depositClaim !== null))
      ? `/account/incidents/${encodeURIComponent(b.id)}` : `/bookings/${encodeURIComponent(b.id)}`,
    priority, deadline: deadline?.toISOString() ?? null,
  });
  if (b.status === "PENDING") {
    const deadline = getApprovalDeadline(b.createdAt);
    return owner && deadline > now ? task("approve", "Odpowiedz na prośbę o wynajem", "Zaakceptuj lub odrzuć rezerwację.", 0, deadline) : null;
  }
  if (b.status === "AWAITING_PAYMENT" && b.paymentStatus === "PENDING") return renter && b.paymentDueAt !== null && !isPaymentDeadlineExpired(b, now) && (DEPOSITS_ENABLED || b.depositCents === 0) ? task("pay", "Opłać rezerwację", "Właściciel zaakceptował prośbę. Dokończ płatność.", 0, b.paymentDueAt) : null;
  if (b.paymentStatus !== "PAID") return null;
  const activeIncident = b.incidents?.find(i => i.status !== "RESOLVED");
  if (activeIncident) {
    const mine = canActOnIncident(activeIncident, owner);
    return mine || activeIncident.status === "AGREEMENT_REACHED" && owner ? task("deliveryIssue", "Sprawdź zgłoszenie i uzgodnienie", activeIncident.stage === "DELIVERY" ? "Wypłata oczekuje na uzgodnienie i rozliczenie dostawy." : "Wyjaśnij zwrot. Należny najem pozostaje bez zmian.", 1) : null;
  }
  const claim = readDepositClaim(b.depositClaim);
  if (b.depositClaim !== null) {
    if (!claim || b.depositStatus !== "PAID") return null;
    if (claim.status === "PENDING") return renter && !owner ? task("claim", "Odpowiedz na propozycję potrącenia", `Proponowane potrącenie: ${(claim.retainedCents / 100).toFixed(2).replace(".", ",")} zł. Zaakceptuj albo zgłoś sprzeciw.`, 0) : null;
    if (claim.status === "APPROVED") return task("settle", "Wykonaj zatwierdzone rozliczenie", "Decyzja została zatwierdzona. Rozliczenie kaucji nie zostało jeszcze zakończone.", 1);
    return null;
  }
  if (b.settlementDecision) return owner ? task("retry", "Sprawdź rozpoczęte rozliczenie", "Rozliczenie nie zostało zakończone. Otwórz rezerwację i sprawdź możliwość ponowienia.", 1) : null;
  if (b.deliveryConfirmationStatus === "DISPUTED") {
    const issue = readIssue(b.deliveryIssue);
    if (renter && (b.deliveryIssue === null || (issue?.reportedById === userId && !issue.resolvedAt))) {
      return task("deliveryIssue", "Wyjaśnij problem z dostawą", "Sprawdź zgłoszenie. Zamknij je dopiero po otrzymaniu przedmiotu i rozwiązaniu problemu.", 1);
    }
    return owner && (b.deliveryIssue === null || (issue?.reportedById === b.renterId && !issue.resolvedAt))
      ? task("deliveryIssueOwner", "Odpowiedz na zgłoszenie dostawy", "Najemca zgłosił problem. Sprawdź zdjęcia, daty i śledzenie; uzgodnij rozwiązanie przez czat.", 1)
      : null;
  }
  if (b.returnConfirmationStatus === "DISPUTED" && !readIssue(b.returnIssue)?.resolvedAt) {
    const issue = readIssue(b.returnIssue);
    if (owner && (b.returnIssue === null || (issue?.reportedById === userId && !issue.resolvedAt))) {
      return task("returnIssue", "Wyjaśnij problem ze zwrotem", (b.depositCents ?? 0) > 0 ? "Sprawdź zgłoszenie: zaproponuj rozliczenie kaucji lub potwierdź rozwiązanie problemu." : "Sprawdź zgłoszenie i potwierdź rozwiązanie problemu.", 1);
    }
    return renter && (b.returnIssue === null || (issue?.reportedById === b.ownerId && !issue.resolvedAt))
      ? task("returnIssueRenter", "Odpowiedz na zgłoszenie zwrotu", (b.depositCents ?? 0) > 0 ? "Właściciel zgłosił problem. Sprawdź zdjęcia, daty i śledzenie; odpowiedz przez czat lub na propozycję rozliczenia kaucji." : "Właściciel zgłosił problem. Sprawdź zdjęcia, daty i śledzenie; odpowiedz przez czat.", 1)
      : null;
  }
  if (renter && canReceive(b, "DELIVERY")) return task("receive", "Sprawdź odbiór przedmiotu", "Po otrzymaniu przedmiotu potwierdź odbiór lub zgłoś problem.");
  if (owner && canReceive(b, "RETURN")) return task("receiveReturn", "Sprawdź odbiór zwrotu", "Po otrzymaniu zwrotu potwierdź odbiór lub zgłoś problem.");
  const delivered = b.shippingStatus === "DELIVERED" && ["CONFIRMED", "AUTO_CONFIRMED"].includes(b.deliveryConfirmationStatus);
  const returned = ["CONFIRMED", "AUTO_CONFIRMED"].includes(b.returnConfirmationStatus);
  if (owner && returned && b.depositStatus === "PAID" && (b.depositCents ?? 0) > 0 && !b.depositDecisionAt && !b.settlementLegacyReview) {
    const deadline = getDepositDecisionDeadline(b.returnConfirmedAt);
    return !deadline || deadline > now ? task("deposit", "Rozlicz kaucję", "Zwrot został potwierdzony. Zwróć kaucję lub zaproponuj uzasadnione potrącenie.", 1, deadline) : null;
  }
  if (owner && delivered && !b.settlementCompletedAt && (b.depositCents ?? 0) === 0 && b.depositStatus === "NONE") return task("rentSettlement", "Rozlicz najem", "Odbiór został potwierdzony. Dokończ wypłatę wynagrodzenia za najem.", 1);
  if (owner && !delivered && !["SHIPPED", "DELIVERED", "CANCELLED"].includes(b.shippingStatus) && !["CONFIRMED", "AUTO_CONFIRMED"].includes(b.deliveryConfirmationStatus)) return task("ship", "Przekaż lub wyślij przedmiot", `Początek najmu: ${b.startDate.toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}. Zapisz wysyłkę po przekazaniu przedmiotu.`);
  if (renter && delivered && !returned && !["SHIPPED", "DELIVERED", "CANCELLED"].includes(b.returnStatus) && b.endDate <= now) return task("return", "Zorganizuj zwrot przedmiotu", "Nadszedł termin zwrotu. Po nadaniu lub przekazaniu przedmiotu zapisz zwrot.");
  return null;
}
export function pendingTasks(bookings: TaskBooking[], userId: string, now = new Date()) {
  return bookings.flatMap(b => { const t = bookingTask(b, userId, now); return t ? [t] : []; }).sort((a, b) => a.priority - b.priority || (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || (b.bookingNumber ?? 0) - (a.bookingNumber ?? 0));
}
