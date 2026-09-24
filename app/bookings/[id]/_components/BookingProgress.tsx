type ProgressBooking = {
  status: string;
  paymentStatus: string;
  shippingStatus: string;
  deliveryConfirmationStatus: string;
  returnStatus: string;
  returnConfirmationStatus: string;
  depositStatus: string;
  depositCents: number | null;
  settlementCompletedAt: Date | null;
};

type Step = { label: string; done: boolean; problem?: boolean; skipped?: boolean };

export default function BookingProgress({ booking }: { booking: ProgressBooking }) {
  const paid = booking.paymentStatus === "PAID";
  const accepted = paid || ["AWAITING_PAYMENT", "CONFIRMED", "PAID"].includes(booking.status);
  const deliveryDone = booking.shippingStatus === "DELIVERED" && ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.deliveryConfirmationStatus);
  const returnDone = ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.returnConfirmationStatus);
  const hasDeposit = (booking.depositCents ?? 0) > 0;
  const settled = !!booking.settlementCompletedAt || ["REFUNDED", "PARTIALLY_REFUNDED", "RETAINED"].includes(booking.depositStatus);
  const steps: Step[] = [
    { label: "Prośba", done: true },
    { label: "Akceptacja", done: accepted },
    { label: "Płatność", done: paid },
    { label: "Dostawa", done: deliveryDone, problem: booking.deliveryConfirmationStatus === "DISPUTED" || booking.shippingStatus === "LOST" },
    { label: "Zwrot", done: returnDone, problem: booking.returnConfirmationStatus === "DISPUTED" || booking.returnStatus === "LOST" },
    { label: "Kaucja", done: returnDone && (!hasDeposit || settled), skipped: !hasDeposit },
  ];
  const current = steps.findIndex(step => !step.done);
  const nextAction = !accepted ? "Właściciel podejmuje decyzję o rezerwacji."
    : !paid ? "Najemca opłaca zaakceptowaną rezerwację."
    : steps[3].problem || steps[4].problem ? "Zgłoszony problem wymaga wyjaśnienia w szczegółach rezerwacji."
    : !deliveryDone ? ["SHIPPED", "DELIVERED"].includes(booking.shippingStatus) ? "Najemca sprawdza i potwierdza odbiór przedmiotu." : "Właściciel przygotowuje i przekazuje przedmiot."
    : !returnDone ? ["SHIPPED", "DELIVERED"].includes(booking.returnStatus) ? "Właściciel sprawdza i potwierdza zwrot." : "Najemca organizuje zwrot przedmiotu."
    : hasDeposit && !settled ? "Właściciel rozlicza kaucję." : "Rezerwacja została zakończona.";

  return <section className="rounded border bg-white p-4 space-y-3" aria-labelledby="booking-progress-title">
    <h2 id="booking-progress-title" className="text-lg font-semibold">Przebieg rezerwacji</h2>
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Etapy rezerwacji">
      {steps.map((step, index) => {
        const state = step.problem ? "Wymaga wyjaśnienia" : step.skipped ? "Nie dotyczy" : step.done ? "Zakończono" : index === current ? "W toku" : "Przed nami";
        const color = step.problem ? "border-rose-300 bg-rose-50 text-rose-900" : step.done ? "border-emerald-200 bg-emerald-50 text-emerald-900" : index === current ? "border-indigo-300 bg-indigo-50 text-indigo-900" : "border-gray-200 bg-gray-50 text-gray-600";
        return <li key={step.label} className={`rounded-lg border p-2 text-sm ${color}`} aria-current={index === current ? "step" : undefined}>
          <span className="block font-semibold">{index + 1}. {step.label}</span>
          <span className="text-xs">{state}</span>
        </li>;
      })}
    </ol>
    <p className="text-sm font-medium text-gray-800">Następny krok: {nextAction}</p>
    <p className="text-xs text-gray-600">Szczegóły i dostępne działania znajdziesz w sekcjach poniżej.</p>
  </section>;
}
