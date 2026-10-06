import { canActOnIncident } from "@/app/lib/incidentPolicy";
import Link from "next/link";
import { bookingTask, type TaskBooking } from "@/app/lib/pendingBookingTasks";
import { readDepositClaim } from "@/app/lib/depositClaim";
import { getApprovalDeadline } from "@/app/lib/approvalExpiry";
import { isPaymentDeadlineExpired } from "@/app/lib/paymentDeadline";
import { getDepositDecisionDeadline } from "@/app/lib/depositAutoReleasePolicy";
import { DEPOSITS_ENABLED } from "@/app/lib/features";

type Props = { booking: TaskBooking; userId: string; ownerPhoneVerified: boolean };

const destination: Record<string, { href: string; label: string }> = {
  approve: { href: "#approval-actions", label: "Podejmij decyzję" },
  ship: { href: "#delivery-section", label: "Zapisz dostawę" },
  receive: { href: "#delivery-section", label: "Sprawdź odbiór" },
  return: { href: "#return-section", label: "Zapisz zwrot" },
  receiveReturn: { href: "#return-section", label: "Sprawdź zwrot" },
  deposit: { href: "#deposit-section", label: "Rozlicz kaucję" },
  retry: { href: "#deposit-section", label: "Sprawdź rozliczenie" },
  rentSettlement: { href: "#rent-settlement-section", label: "Rozlicz najem" },
};

function waitingMessage(booking: TaskBooking, userId: string) {
  const owner = booking.ownerId === userId;
  const claim = readDepositClaim(booking.depositClaim);
  if (booking.status === "CANCELLED") return "Rezerwacja została anulowana. Sprawdź jej rozliczenie poniżej.";
  const active = booking.incidents?.find(i => i.status !== "RESOLVED");
  if (active) return active.status === "AGREEMENT_REACHED" ? "Rozwiązanie zostało zaakceptowane. Czekamy na zakończenie rozliczenia." : `Czekamy na odpowiedź ${canActOnIncident(active, true) ? "właściciela" : "najemcy"} w zgłoszeniu dotyczącym ${active.stage === "DELIVERY" ? "dostawy" : "zwrotu"}.`;
  if (booking.settlementCompletedAt && ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.returnConfirmationStatus)) return "Zwrot i rozliczenie rezerwacji zostały zakończone.";
  if (claim?.status === "PENDING") return owner ? "Czekamy na odpowiedź najemcy na propozycję potrącenia z kaucji." : "Sprawdź propozycję potrącenia w incydencie.";
  if (claim?.status === "DISPUTED") return "Spór o kaucję oczekuje na decyzję obsługi serwisu.";
  if (claim?.status === "APPROVED" && !booking.settlementCompletedAt) return "Rozliczenie kaucji zostało zatwierdzone. Oczekujemy na jego wykonanie.";
  if (booking.status === "PENDING") return getApprovalDeadline(booking.createdAt) <= new Date() ? "Termin akceptacji minął. Rezerwacja oczekuje na anulowanie." : "Czekamy na decyzję właściciela o rezerwacji.";
  if (booking.status === "AWAITING_PAYMENT" && booking.paymentStatus === "PENDING") return !DEPOSITS_ENABLED && booking.depositCents !== 0 ? "Ta wcześniejsza rezerwacja zawiera kaucję i nie może być już opłacona. Poczekaj na jej anulowanie, a następnie złóż nową prośbę bez kaucji." : isPaymentDeadlineExpired(booking) ? "Termin płatności minął. Rezerwacja oczekuje na sprawdzenie płatności." : "Czekamy na płatność najemcy.";
  if (booking.paymentStatus !== "PAID") return "Czekamy na potwierdzenie płatności.";
  const delivered = booking.shippingStatus === "DELIVERED" && ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.deliveryConfirmationStatus);
  if (!delivered) return owner ? "Czekamy na potwierdzenie odbioru przez najemcę." : "Czekamy na wysłanie lub przekazanie przedmiotu przez właściciela.";
  const returned = ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.returnConfirmationStatus);
  if (!returned) return owner ? "Czekamy na zwrot przedmiotu przez najemcę." :
    booking.endDate > new Date() ? `Wynajem trwa. Termin zwrotu: ${booking.endDate.toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}.` : "Czekamy na potwierdzenie zwrotu przez właściciela.";
  if (booking.depositStatus === "PAID" && (booking.depositCents ?? 0) > 0) {
    const deadline = getDepositDecisionDeadline(booking.returnConfirmedAt);
    return deadline && deadline <= new Date() ? "Termin decyzji o kaucji minął. Czekamy na automatyczny zwrot." : "Czekamy na rozliczenie kaucji przez właściciela.";
  }
  if ((booking.depositCents ?? 0) === 0 && booking.depositStatus === "NONE") return owner ? "Zwrot potwierdzony. Rozlicz wynagrodzenie za najem." : "Zwrot potwierdzony. Oczekujemy na rozliczenie najmu z właścicielem.";
  return "Wszystkie kroki rezerwacji zostały zakończone.";
}

export default function BookingNextAction({ booking, userId, ownerPhoneVerified }: Props) {
  const task = bookingTask(booking, userId);
  const kind = task?.id.slice(booking.id.length + 1) ?? "";
  const target = task ? task.href.startsWith("/account/incidents/")
    ? { href: task.href, label: "Odpowiedz na zgłoszenie" }
    : kind === "approve" && !ownerPhoneVerified ? { href: `/account?returnTo=${encodeURIComponent(`/bookings/${booking.id}`)}#telefon`, label: "Zweryfikuj numer telefonu" }
    : kind === "pay" ? { href: `/bookings/${encodeURIComponent(booking.id)}/pay`, label: "Przejdź do płatności" }
    : destination[kind] : null;
  const returned = ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.returnConfirmationStatus);
  const finished = booking.status === "CANCELLED" || (returned && !!booking.settlementCompletedAt && !booking.incidents?.some(i => i.status !== "RESOLVED")) ||
    (returned && (booking.depositCents ?? 0) > 0 && ["REFUNDED", "PARTIALLY_REFUNDED", "RETAINED"].includes(booking.depositStatus));
  return <section className={`rounded-2xl border p-5 sm:p-6 space-y-3 ${task ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-slate-50"}`} aria-labelledby="booking-next-action">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{finished ? "Stan rezerwacji" : task ? "Co teraz zrobić?" : "Na co czekamy?"}</p>
    <h2 id="booking-next-action" className="text-xl font-semibold">{task ? task.title : finished ? booking.status === "CANCELLED" ? "Rezerwacja anulowana" : "Rezerwacja zakończona" : "Teraz czekamy"}</h2>
    <p className="text-sm text-gray-700">{task ? task.description : waitingMessage(booking, userId)}</p>
    {task?.deadline && <p className="text-sm font-medium text-rose-800">Termin: {new Date(task.deadline).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>}
    {target && <Link href={target.href} className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">{target.label} →</Link>}
  </section>;
}
