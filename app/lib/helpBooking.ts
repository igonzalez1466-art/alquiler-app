import type { Booking } from "@prisma/client";
import { bookingTask, type TaskBooking } from "@/app/lib/pendingBookingTasks";
import { canActOnIncident, incidentReasons } from "@/app/lib/incidentPolicy";
import { canReturnCancelledIncidentBooking } from "@/app/lib/cancelledIncidentReturn";

export type HelpBooking = Omit<TaskBooking, "incidents"> & Pick<Booking, "carrier" | "trackingNumber" | "returnCarrier" | "returnTrackingNumber"> & {
  incidents: { stage: "DELIVERY" | "RETURN"; status: string; reason: keyof typeof incidentReasons; acceptedAt: Date | null; refundCents: number | null }[];
};
export type HelpBookingSummary = {
  id: string; number: number | null; title: string; role: string; startDate: string; endDate: string;
  status: string; payment: string; delivery: string; returnState: string; incident: string | null;
  next: { text: string; label: string; href: string }; href: string;
};
const confirmed = (status: string) => ["CONFIRMED", "AUTO_CONFIRMED"].includes(status);
const statusLabels: Record<string, string> = { PENDING: "Oczekuje na decyzję właściciela", AWAITING_PAYMENT: "Oczekuje na płatność", CONFIRMED: "Potwierdzona", PAID: "Opłacona", CANCELLED: "Anulowana" };
const paymentLabels: Record<string, string> = { PENDING: "Nieopłacona", AUTHORIZED: "Płatność autoryzowana", PAID: "Opłacona", REFUNDED: "Zwrot płatności zapisany — termin zaksięgowania zależy od banku", FAILED: "Płatność nieudana", CANCELLED: "Płatność anulowana" };
function deliveryText(status: string, confirmation: string, carrier: string | null, tracking: string | null) {
  const progress = confirmed(confirmation) ? "Odbiór potwierdzony" : status === "SHIPPED" || status === "DELIVERED"
    ? carrier === "Odbiór osobisty" ? "Przekazanie osobiste zapisane — odbiór niepotwierdzony" : "Wysyłka zapisana — odbiór niepotwierdzony"
    : status === "LOST" ? "Zgłoszono zaginięcie" : status === "CANCELLED" ? "Anulowana" : "Przekazanie / wysyłka jeszcze nie zostały zapisane";
  return progress + (carrier ? " · " + carrier : "") + (tracking && carrier !== "Odbiór osobisty" ? " · Numer przesyłki: " + tracking : "");
}
export function helpBookingSummary(b: HelpBooking, userId: string): HelpBookingSummary {
  if (![b.ownerId, b.renterId].includes(userId)) throw new Error("Brak dostępu.");
  const owner = userId === b.ownerId, href = "/bookings/" + encodeURIComponent(b.id);
  const active = b.incidents.find(i => i.status !== "RESOLVED");
  const incidentHref = "/account/incidents/" + encodeURIComponent(b.id);
  let next = { text: "Sprawdź szczegóły i aktualne działania na stronie rezerwacji.", label: "Otwórz rezerwację", href };
  const task = bookingTask(b, userId);
  if (task) {
    const kind = task.id.slice(b.id.length + 1);
    next = { text: task.title + ". " + task.description, label: task.actionLabel ?? "Przejdź do działania", href: kind === "pay" ? href + "/pay" : task.href };
  } else if (active) next = { text: active.status === "AGREEMENT_REACHED" ? "Obie strony zaakceptowały rozwiązanie. Rozliczenie jest w toku." : "Czekamy na odpowiedź " + (canActOnIncident(active, true) ? "właściciela" : "najemcy") + ".", label: "Zobacz zgłoszenie", href: incidentHref };
  else if (b.status === "CANCELLED") next.text = "Rezerwacja anulowana. Szczegóły ewentualnego zwrotu płatności znajdziesz w rezerwacji.";
  else if (b.status === "PENDING") next.text = "Czekamy na decyzję właściciela. Sprawdź termin odpowiedzi w rezerwacji.";
  else if (b.status === "AWAITING_PAYMENT") next.text = "Czekamy na płatność najemcy. Sprawdź termin płatności w rezerwacji.";
  else if (b.paymentStatus !== "PAID") next.text = "Sprawdź aktualny stan płatności na stronie rezerwacji.";
  else if (!confirmed(b.deliveryConfirmationStatus)) next.text = owner ? "Czekamy na potwierdzenie odbioru przez najemcę." : "Czekamy na przekazanie lub wysyłkę przez właściciela.";
  else if (!confirmed(b.returnConfirmationStatus)) next = { text: "Najem trwa lub czekamy na zakończenie zwrotu. Uzgodnij szczegóły na czacie i sprawdź termin rezerwacji.", label: "Sprawdź zwrot", href: href + "#return-section" };
  else next.text = "Odbiór zwrotu potwierdzony. Szczegóły rozliczenia znajdziesz w rezerwacji.";
  if (canReturnCancelledIncidentBooking(b) && !confirmed(b.returnConfirmationStatus)) next = { text: "Jeśli przedmiot został odebrany, uzgodnij jego jak najszybszy zwrot na czacie. Anulowanie nie kończy fizycznego zwrotu przedmiotu.", label: "Otwórz sekcję zwrotu", href: href + "#return-section" };
  return { id: b.id, number: b.bookingNumber, title: b.listing.title, role: owner ? "Właściciel" : "Najemca", startDate: b.startDate.toISOString().slice(0,10), endDate: b.endDate.toISOString().slice(0,10), status: statusLabels[b.status] ?? "Sprawdź w rezerwacji", payment: paymentLabels[b.paymentStatus] ?? "Sprawdź w rezerwacji", delivery: deliveryText(b.shippingStatus, b.deliveryConfirmationStatus, b.carrier, b.trackingNumber), returnState: deliveryText(b.returnStatus, b.returnConfirmationStatus, b.returnCarrier, b.returnTrackingNumber), incident: active ? (active.stage === "DELIVERY" ? "Dostawa" : "Zwrot") + ": " + incidentReasons[active.reason] : b.incidents.length ? "Zgłoszenie zakończone" : null, next, href };
}
