type ProgressBooking = {
  status: string; paymentStatus: string; shippingStatus: string; deliveryConfirmationStatus: string;
  returnStatus: string; returnConfirmationStatus: string; depositStatus: string; depositCents: number | null;
  settlementCompletedAt: Date | null; incidents?: { stage: string; status: string }[];
};
export default function BookingProgress({ booking }: { booking: ProgressBooking }) {
  const paid = ["PAID", "REFUNDED"].includes(booking.paymentStatus);
  const received = ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.deliveryConfirmationStatus);
  const returned = ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.returnConfirmationStatus);
  const active = booking.incidents?.filter(i => i.status !== "RESOLVED") ?? [];
  const settled = !!booking.settlementCompletedAt || ["REFUNDED", "PARTIALLY_REFUNDED", "RETAINED"].includes(booking.depositStatus);
  const steps = [
    { label: "Rezerwacja", done: paid || ["AWAITING_PAYMENT", "CONFIRMED", "PAID"].includes(booking.status) },
    { label: "Płatność", done: paid },
    { label: "Dostawa", done: received, problem: active.some(i => i.stage === "DELIVERY") || booking.deliveryConfirmationStatus === "DISPUTED" },
    { label: "Zwrot", done: returned, problem: active.some(i => i.stage === "RETURN") || booking.returnConfirmationStatus === "DISPUTED" },
    { label: "Zakończono", done: returned && settled && active.length === 0 },
  ];
  const current = steps.findIndex(step => step.problem || !step.done);
  return <section className="rounded-2xl border bg-white p-4 sm:p-5" aria-label="Przebieg rezerwacji">
    <ol className="flex gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-5">
      {steps.map((step, index) => <li key={step.label} aria-current={index === current ? "step" : undefined} className={`min-w-28 flex-1 rounded-xl p-3 text-sm ${step.problem ? "bg-amber-50 text-amber-900" : step.done ? "bg-emerald-50 text-emerald-900" : index === current ? "bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200" : "bg-slate-50 text-slate-500"}`}>
        <span aria-hidden="true" className="mb-2 flex h-7 w-7 items-center justify-center rounded-full border bg-white font-semibold">{step.problem ? "!" : step.done ? "✓" : index + 1}</span>
        <span className="block font-semibold">{step.label}</span>
        <span className="text-xs">{step.problem ? "Reklamacja" : step.done ? "Gotowe" : index === current ? "Teraz" : "Przed nami"}</span>
      </li>)}
    </ol>
  </section>;
}
