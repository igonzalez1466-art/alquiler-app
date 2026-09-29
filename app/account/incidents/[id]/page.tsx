import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { hasIncident, incidentState, incidentTimeline, incidentTopics } from "@/app/lib/incidentCase";
import { canViewBookingEvidencePhoto } from "@/app/lib/bookingEvidenceVisibility";
import { canUploadBookingEvidence } from "@/app/lib/bookingEvidence";
import { canClaimNotReturned, claimReasonFromReturnIssue, isNotReturnedClaimReason, readDepositClaim } from "@/app/lib/depositClaim";
import { hasReturnReceipt, readIssue } from "@/app/lib/logisticsIssue";
import { canReceive } from "@/app/lib/logistics";
import LogisticsIssuePanel from "@/app/bookings/[id]/_components/LogisticsIssuePanel";
import BookingEvidencePhotos from "@/app/bookings/[id]/_components/BookingEvidencePhotos";
import DepositClaimPanel from "@/app/bookings/[id]/_components/DepositClaimPanel";
import DepositActions from "@/app/bookings/[id]/_components/DepositActions";
import BookingActionFeedback from "@/app/bookings/[id]/_components/BookingActionFeedback";

export const dynamic = "force-dynamic";
const datePL = (date: Date) => date.toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "medium", timeStyle: "short" });
const money = (cents: number | null) => cents === null ? "—" : new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(cents / 100);

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/account/incidents/${id}`)}`);
  const userId = session.user.id;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { listing: { select: { title: true } } } });
  if (!booking || ![booking.ownerId, booking.renterId].includes(userId) || !hasIncident(booking)) notFound();
  const isOwner = booking.ownerId === userId;
  const isRenter = booking.renterId === userId;
  const claim = readDepositClaim(booking.depositClaim);
  const returnIssue = readIssue(booking.returnIssue);
  const photos = await prisma.bookingEvidencePhoto.findMany({
    where: { bookingId: id }, select: { id: true, stage: true, uploaderId: true, createdAt: true }, orderBy: { createdAt: "asc" },
  });
  const visiblePhotos = photos.filter(photo => canViewBookingEvidencePhoto(booking, photo, userId));
  const state = incidentState(booking, userId);
  const timeline = [
    ...incidentTimeline(booking),
    ...visiblePhotos.map(photo => ({ at: photo.createdAt, title: `${photo.uploaderId === booking.ownerId ? "Właściciel" : "Najemca"} dodał zdjęcie`, detail: photo.stage === "DELIVERY" ? "Dostawa" : "Zwrot" })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const deliveryCompleted = booking.shippingStatus === "DELIVERED" && ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.deliveryConfirmationStatus);
  const returnCompleted = ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.returnConfirmationStatus);
  const settlementPending = !!booking.settlementDecision && !booking.settlementCompletedAt;
  const canManageDeposit = isOwner && booking.paymentStatus === "PAID" && returnCompleted && (booking.depositCents ?? 0) > 0 && (booking.depositStatus === "PAID" || settlementPending);
  const canPropose = isOwner && booking.paymentStatus === "PAID" && booking.depositStatus === "PAID" && !booking.settlementDecision && !booking.settlementCompletedAt && deliveryCompleted && ["SHIPPED", "DELIVERED"].includes(booking.returnStatus) && returnIssue?.reason !== "NOT_RECEIVED";
  const canProposeNotReturned = isOwner && booking.paymentStatus === "PAID" && booking.depositStatus === "PAID" && !booking.settlementDecision && !booking.settlementCompletedAt && canClaimNotReturned(booking);

  return <main className="mx-auto max-w-4xl space-y-6 p-4">
    <nav className="flex flex-wrap gap-4 text-sm"><Link href="/account/incidents" className="underline">← Moje incydenty</Link><Link href={`/bookings/${encodeURIComponent(id)}`} className="underline">Rezerwacja #{booking.bookingNumber}</Link></nav>
    <BookingActionFeedback bookingId={id} />
    <header className="rounded-xl border bg-white p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Sprawa rezerwacji #{booking.bookingNumber}</h1><p className="text-gray-600">{booking.listing.title} · {isOwner ? "Właściciel" : "Najemca"}</p></div><span className={`rounded-full px-3 py-1 text-sm font-semibold ${state.needsAction ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{state.label}</span></div>
      <div className="flex flex-wrap gap-2">{incidentTopics(booking).map(topic => <span key={topic.label} className="rounded border px-2 py-1 text-xs">{topic.label}: {topic.detail}</span>)}</div>
      <p className="text-sm"><strong>Następny krok:</strong> {state.next}</p>
    </header>

    <section className="rounded-xl border bg-white p-5 space-y-4" aria-labelledby="incident-timeline">
      <h2 id="incident-timeline" className="text-lg font-semibold">Przebieg sprawy</h2>
      {timeline.length ? <ol className="space-y-3 border-l-2 border-indigo-200 pl-5">{timeline.map((event, index) => <li key={`${event.at.toISOString()}-${index}`} className="relative"><span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-600" /><p className="text-xs text-gray-600">{datePL(event.at)}</p><p className="font-medium">{event.title}</p>{event.detail && <p className="text-sm text-gray-700">{event.detail}</p>}</li>)}</ol> : <p className="text-sm text-gray-600">Brak dat dla wcześniejszego zgłoszenia. Jego aktualny stan widoczny jest poniżej.</p>}
    </section>

    {(booking.deliveryIssue !== null || booking.deliveryConfirmationStatus === "DISPUTED") && <section className="space-y-3" aria-labelledby="incident-delivery">
      <h2 id="incident-delivery" className="text-lg font-semibold">Dostawa</h2>
      <LogisticsIssuePanel bookingId={id} stage="DELIVERY" stored={booking.deliveryIssue} disputed={booking.deliveryConfirmationStatus === "DISPUTED"} recipientId={booking.renterId} userId={userId} canResolve={canReceive({ ...booking, deliveryConfirmationStatus: "AWAITING_CONFIRMATION" }, "DELIVERY")}
        facts={{ expectedAt: booking.startDate, sentAt: booking.shippedAt, receivedAt: booking.deliveredAt, carrier: booking.carrier, trackingNumber: booking.trackingNumber, ownerPhotos: visiblePhotos.filter(photo => photo.stage === "DELIVERY" && photo.uploaderId === booking.ownerId).length, renterPhotos: visiblePhotos.filter(photo => photo.stage === "DELIVERY" && photo.uploaderId === booking.renterId).length, rentCents: booking.rentAmountCents, depositCents: booking.depositCents }} />
      <BookingEvidencePhotos bookingId={id} stage="DELIVERY" userId={userId} ownerId={booking.ownerId} renterId={booking.renterId} canUpload={canUploadBookingEvidence(booking, "DELIVERY", userId)} photos={visiblePhotos.filter(photo => photo.stage === "DELIVERY").map(photo => ({ ...photo, createdAt: photo.createdAt.toISOString() }))} />
    </section>}

    {(booking.returnIssue !== null || booking.returnConfirmationStatus === "DISPUTED") && <section className="space-y-3" aria-labelledby="incident-return">
      <h2 id="incident-return" className="text-lg font-semibold">Zwrot</h2>
      <LogisticsIssuePanel bookingId={id} stage="RETURN" stored={booking.returnIssue} disputed={booking.returnConfirmationStatus === "DISPUTED"} recipientId={booking.ownerId} userId={userId} receiptConfirmed={booking.returnConfirmedAt !== null} hasDepositClaim={claim !== null} claimNotReturned={isNotReturnedClaimReason(claim?.reasonCode ?? "")} canResolve={booking.depositClaim === null && canReceive({ ...booking, returnConfirmationStatus: "AWAITING_CONFIRMATION" }, "RETURN")}
        facts={{ expectedAt: booking.endDate, sentAt: booking.returnShippedAt, receivedAt: booking.returnDeliveredAt, carrier: booking.returnCarrier, trackingNumber: booking.returnTrackingNumber, ownerPhotos: visiblePhotos.filter(photo => photo.stage === "RETURN" && photo.uploaderId === booking.ownerId).length, renterPhotos: visiblePhotos.filter(photo => photo.stage === "RETURN" && photo.uploaderId === booking.renterId).length, rentCents: booking.rentAmountCents, depositCents: booking.depositCents }} />
      <BookingEvidencePhotos bookingId={id} stage="RETURN" userId={userId} ownerId={booking.ownerId} renterId={booking.renterId} canUpload={canUploadBookingEvidence(booking, "RETURN", userId)} photos={visiblePhotos.filter(photo => photo.stage === "RETURN").map(photo => ({ ...photo, createdAt: photo.createdAt.toISOString() }))} />
    </section>}

    {(booking.returnIssue !== null || booking.depositClaim !== null || booking.returnConfirmationStatus === "DISPUTED") && <section className="rounded-xl border bg-white p-5 space-y-4" aria-labelledby="incident-deposit">
      <h2 id="incident-deposit" className="text-lg font-semibold">Kaucja i decyzja</h2>
      <p className="text-sm">Wpłacona kaucja: <strong>{money(booking.depositCents)}</strong> · Zwrócono: <strong>{money(booking.depositRefundedCents)}</strong> · Zatrzymano: <strong>{money(booking.depositRetainedCents)}</strong></p>
      <DepositClaimPanel bookingId={id} depositCents={booking.depositCents ?? 0} claim={claim} hasClaim={booking.depositClaim !== null} isOwner={isOwner} isRenter={isRenter} returnCompleted={returnCompleted} receiptKnown={hasReturnReceipt(booking)} canPropose={canPropose} canProposeNotReturned={canProposeNotReturned} initialReason={returnIssue?.description ?? ""} initialReasonCode={claimReasonFromReturnIssue(returnIssue?.reason)} completed={!!booking.settlementCompletedAt} settling={settlementPending} canRefund={canManageDeposit && !booking.settlementDecision} />
      {canManageDeposit && settlementPending && booking.depositClaim === null && <DepositActions settlementPending bookingId={id} depositZl={(booking.depositCents ?? 0) / 100} />}
    </section>}
    <p className="text-xs text-gray-600">Daty pochodzą z zapisów aplikacji. Zgłoszenie problemu i propozycja potrącenia same nie przenoszą środków.</p>
  </main>;
}
