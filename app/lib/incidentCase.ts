import { formatIncidentEvidenceText } from "@/app/lib/incidentFormatting";
import type { Booking } from "@prisma/client";
import { canActOnIncident } from "@/app/lib/incidentPolicy";
import { claimReasons, readDepositClaim } from "@/app/lib/depositClaim";
import { issueReasonLabel, readIssue } from "@/app/lib/logisticsIssue";
import { getDepositDecisionDeadline } from "@/app/lib/depositAutoReleasePolicy";

type IncidentBooking = Pick<Booking,
  "ownerId" | "renterId" | "status" | "deliveryIssue" | "returnIssue" | "depositClaim" |
  "deliveryConfirmationStatus" | "returnConfirmationStatus" | "depositStatus" |
  "depositDecisionAt" | "settlementCompletedAt" | "shippedAt" | "returnShippedAt" |
  "deliveredAt" | "deliveryConfirmedAt" | "returnDeliveredAt" | "returnConfirmedAt" |
  "depositRefundedAt" | "depositRetainedCents" | "depositCents"
> & { incidents?: { stage: string; status: string; proposedById: string | null; reason: string; createdAt?: Date; description?: string; resolvedAt?: Date | null; resolution?: string | null; evidence?: { uploaderId: string; text: string; createdAt: Date }[] }[] };

export type IncidentEvent = { at: Date; title: string; detail?: string };

export function hasIncident(booking: IncidentBooking) {
  return booking.deliveryIssue !== null || booking.returnIssue !== null || booking.depositClaim !== null ||
    booking.deliveryConfirmationStatus === "DISPUTED" || booking.returnConfirmationStatus === "DISPUTED";
}

export function incidentTopics(booking: IncidentBooking) {
  const delivery = readIssue(booking.deliveryIssue);
  const returned = readIssue(booking.returnIssue);
  const claim = readDepositClaim(booking.depositClaim);
  const topics: { label: string; detail: string }[] = [];
  if (booking.deliveryIssue !== null || booking.deliveryConfirmationStatus === "DISPUTED") {
    topics.push({ label: "Dostawa", detail: delivery ? issueReasonLabel(delivery.reason) : "Zgłoszenie wymaga sprawdzenia" });
  }
  if (booking.returnIssue !== null || booking.returnConfirmationStatus === "DISPUTED") {
    topics.push({ label: "Zwrot", detail: returned ? issueReasonLabel(returned.reason) : "Zgłoszenie wymaga sprawdzenia" });
  }
  if (booking.depositClaim !== null) {
    topics.push({ label: "Kaucja", detail: claim ? claimReasons[claim.reasonCode] : "Roszczenie wymaga weryfikacji" });
  }
  return topics;
}

export function incidentState(booking: IncidentBooking, userId: string) {
  const current = booking.incidents?.find(i => i.status !== "RESOLVED");
  if (current) {
    const needsAction = [booking.ownerId, booking.renterId].includes(userId) && canActOnIncident(current, booking.ownerId === userId);
    return { label: current.status === "AGREEMENT_REACHED" ? "Uzgodnione — rozliczenie w toku" : current.status === "ESCALATED" ? "Wymaga wyjaśnienia" : needsAction ? "Twoja kolej" : canActOnIncident(current, true) ? "Czeka na właściciela" : "Czeka na najemcę", next: current.status === "AGREEMENT_REACHED" ? "Obie strony zaakceptowały rozwiązanie. Trwa realizacja uzgodnionego rozliczenia." : needsAction ? current.stage === "DELIVERY" ? "Sprawdź ostatnią propozycję i odpowiedz poniżej. Wypłata pozostaje wstrzymana." : "Sprawdź zgłoszenie zwrotu i odpowiedz poniżej. Należny najem pozostaje bez zmian." : "Czekamy na odpowiedź drugiej strony. Otrzymasz powiadomienie, gdy będzie Twoja kolej.", needsAction };
  }
  if (booking.incidents?.length) return { label: "Zakończona", next: "Zobacz rozwiązanie i dowody.", needsAction: false };
  const claim = readDepositClaim(booking.depositClaim);
  if (booking.status === "CANCELLED") return { label: "Rezerwacja anulowana", next: "Sprawdź rozliczenie rezerwacji.", needsAction: false };
  if (booking.depositClaim !== null && !claim) return { label: "Wymaga weryfikacji", next: "Skontaktuj się z obsługą serwisu.", needsAction: false };
  if (claim && booking.settlementCompletedAt) return { label: "Zakończona", next: "Zobacz decyzję i zapisane rozliczenie kaucji.", needsAction: false };
  if (claim?.status === "PENDING") return booking.renterId === userId
    ? { label: "Czeka na Twoją odpowiedź", next: "Zaakceptuj lub zakwestionuj propozycję potrącenia.", needsAction: true }
    : { label: "Czeka na najemcę", next: "Najemca może zaakceptować lub zakwestionować propozycję.", needsAction: false };
  if (claim?.status === "DISPUTED") return { label: "Spór w obsłudze", next: "Obsługa musi rozstrzygnąć zgłoszone zastrzeżenia.", needsAction: false };
  if (claim?.status === "APPROVED" && !booking.settlementCompletedAt) return {
    label: "Rozliczenie zatwierdzone", next: "Wykonaj zatwierdzone rozliczenie kaucji.", needsAction: true,
  };
  if (booking.deliveryConfirmationStatus === "DISPUTED") return {
    label: "Problem z dostawą", next: booking.renterId === userId ? "Sprawdź stan sprawy i zamknij ją dopiero po rozwiązaniu problemu." : "Wyjaśnij zgłoszenie z najemcą.",
    needsAction: true,
  };
  if (booking.returnConfirmationStatus === "DISPUTED") return {
    label: "Problem ze zwrotem", next: booking.ownerId === userId ? (booking.depositCents ?? 0) > 0 ? "Wyjaśnij problem albo zaproponuj rozliczenie kaucji." : "Wyjaśnij problem ze zwrotem." : "Sprawdź zgłoszenie i odpowiedz właścicielowi.",
    needsAction: true,
  };
  if (booking.returnIssue !== null && booking.depositStatus === "PAID" && !booking.depositDecisionAt && !booking.settlementCompletedAt) {
    const deadline = getDepositDecisionDeadline(booking.returnConfirmedAt);
    const overdue = !!deadline && deadline <= new Date();
    return {
      label: "Oczekuje na rozliczenie kaucji",
      next: overdue ? "Termin decyzji minął. Oczekujemy na automatyczny zwrot kaucji." :
        booking.ownerId === userId ? "Zwróć kaucję albo przedstaw uzasadnioną propozycję potrącenia." : "Właściciel rozlicza kaucję.",
      needsAction: booking.ownerId === userId && !overdue,
    };
  }
  return { label: "Zakończona", next: "Zobacz przebieg sprawy i zapisane rozliczenie.", needsAction: false };
}

export type IncidentBucket = "action" | "waiting" | "closed";

export function incidentBucket(booking: IncidentBooking, userId: string): IncidentBucket {
  const state = incidentState(booking, userId);
  if (state.needsAction) return "action";
  return state.label === "Zakończona" || state.label === "Rezerwacja anulowana" ? "closed" : "waiting";
}

export function incidentTimeline(booking: IncidentBooking): IncidentEvent[] {
  const events: IncidentEvent[] = [];
  const add = (value: Date | string | null | undefined, title: string, detail?: string) => {
    if (!value) return;
    const at = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(at.getTime())) return;
    events.push({ at, title, detail });
  };
  for (const incident of booking.incidents ?? []) {
    const stage = incident.stage === "DELIVERY" ? "Dostawa" : "Zwrot";
    add(incident.createdAt, `${stage}: otwarto zgłoszenie`, incident.description);
    for (const evidence of incident.evidence ?? []) {
      const actor = evidence.uploaderId === booking.ownerId ? "Właściciel" : "Najemca";
      const action = evidence.text.startsWith("Propozycja:") ? "nowa propozycja" : evidence.text.startsWith("Zaakceptowano") ? "akceptacja propozycji" : evidence.text.startsWith("Odrzucono") ? "odrzucenie propozycji" : evidence.text.startsWith("Poproszono") ? "prośba o wyjaśnienie" : evidence.text.startsWith("Ponowiono") ? "sprawdzenie rozliczenia" : "komentarz / dowód";
      add(evidence.createdAt, `${stage} · ${actor}: ${action}`, formatIncidentEvidenceText(evidence.text));
    }
    add(incident.resolvedAt, `${stage}: zgłoszenie zakończone`, incident.resolution ?? undefined);
  }
  const delivery = readIssue(booking.deliveryIssue);
  const returned = readIssue(booking.returnIssue);
  const claim = readDepositClaim(booking.depositClaim);
  if (booking.deliveryIssue !== null) {
    add(booking.shippedAt, "Właściciel oznaczył dostawę jako wysłaną");
    add(booking.deliveredAt, "Odbiór dostawy zapisano w aplikacji");
    if (!booking.incidents?.some(i => i.stage === "DELIVERY")) add(delivery?.reportedAt, "Najemca zgłosił problem z dostawą", delivery ? issueReasonLabel(delivery.reason) : undefined);
    if (!booking.incidents?.some(i => i.stage === "DELIVERY")) add(delivery?.resolvedAt, "Problem z dostawą został zamknięty");
    add(booking.deliveryConfirmedAt, "Odbiór dostawy został potwierdzony");
  }
  if (booking.returnIssue !== null || booking.depositClaim !== null) {
    add(booking.returnShippedAt, "Najemca oznaczył zwrot jako wysłany");
    add(booking.returnDeliveredAt, "Odbiór zwrotu zapisano w aplikacji");
    if (!booking.incidents?.some(i => i.stage === "RETURN")) add(returned?.reportedAt, "Właściciel zgłosił problem ze zwrotem", returned ? issueReasonLabel(returned.reason) : undefined);
    if (!booking.incidents?.some(i => i.stage === "RETURN")) add(returned?.resolvedAt, "Problem ze zwrotem został zamknięty");
    add(booking.returnConfirmedAt, "Odbiór zwrotu został potwierdzony");
  }
  add(claim?.proposedAt, "Właściciel zaproponował potrącenie z kaucji", claim ? claimReasons[claim.reasonCode] : undefined);
  if (claim?.respondedAt) add(claim.respondedAt, claim.renterResponse ? "Najemca zakwestionował propozycję" : "Najemca zaakceptował propozycję");
  if (claim?.resolutionSource === "SUPPORT") add(claim.approvedAt, "Obsługa rozstrzygnęła spór");
  add(booking.settlementCompletedAt, (booking.depositCents ?? 0) > 0 ? "Rozliczenie kaucji zostało zapisane" : "Rozliczenie najmu zostało zapisane");
  add(booking.depositRefundedAt, "Zwrot kaucji został zlecony", (booking.depositRetainedCents ?? 0) > 0 ? "Część kaucji została zatrzymana." : undefined);
  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Summarize the saved photo set once per participant and incident stage. */
export function incidentPhotoEvents(booking: { ownerId: string }, photos: { stage: string; uploaderId: string; createdAt: Date }[]): IncidentEvent[] {
  const groups = new Map<string, { stage: string; uploaderId: string; at: Date; count: number }>();
  for (const photo of photos) {
    const key = JSON.stringify([photo.stage, photo.uploaderId]);
    const group = groups.get(key);
    if (group) {
      group.count++;
      if (photo.createdAt > group.at) group.at = photo.createdAt;
    } else groups.set(key, { stage: photo.stage, uploaderId: photo.uploaderId, at: photo.createdAt, count: 1 });
  }
  return Array.from(groups.values(), group => {
    const actor = group.uploaderId === booking.ownerId ? "Właściciel" : "Najemca";
    const noun = group.count === 1 ? "zdjęcie" : group.count % 10 >= 2 && group.count % 10 <= 4 && !(group.count % 100 >= 12 && group.count % 100 <= 14) ? "zdjęcia" : "zdjęć";
    return { at: group.at, title: actor + " dodał " + group.count + " " + noun, detail: group.stage === "DELIVERY" ? "Dostawa" : "Zwrot" };
  });
}
