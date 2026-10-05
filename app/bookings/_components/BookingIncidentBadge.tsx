import Link from "next/link";
import { canActOnIncident } from "@/app/lib/incidentPolicy";

type Booking = {
  id: string;
  ownerId: string;
  deliveryConfirmationStatus: string;
  returnConfirmationStatus: string;
  incidents: { stage: string; status: string }[];
};

export default function BookingIncidentBadge({ booking, userId }: { booking: Booking; userId: string }) {
  const current = booking.incidents.find(incident => incident.status !== "RESOLVED");
  const legacyDelivery = !booking.incidents.some(i => i.stage === "DELIVERY") && booking.deliveryConfirmationStatus === "DISPUTED";
  const legacyReturn = !booking.incidents.some(i => i.stage === "RETURN") && booking.returnConfirmationStatus === "DISPUTED";
  if (!current && !legacyDelivery && !legacyReturn) return null;
  const stage = current?.stage ?? (legacyDelivery ? "DELIVERY" : "RETURN");
  const next = !current ? "Wymaga wyjaśnienia" : current.status === "AGREEMENT_REACHED" ? "Rozliczenie w toku"
    : canActOnIncident(current, booking.ownerId === userId) ? "Twój ruch"
    : current.status === "AWAITING_OWNER" || (["OPEN", "ESCALATED"].includes(current.status) && current.stage === "DELIVERY") ? "Czeka na właściciela" : "Czeka na najemcę";

  return <Link href={`/account/incidents/${encodeURIComponent(booking.id)}`} className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700">
    Reklamacja — {stage === "DELIVERY" ? "dostawa" : "zwrot"} · {next}
  </Link>;
}
