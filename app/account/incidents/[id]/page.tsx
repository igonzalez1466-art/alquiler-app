import IncidentTimeline from "./IncidentTimeline";
import BookingIncidents from "@/app/bookings/[id]/_components/BookingIncidents";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { hasIncident, incidentState, incidentTimeline, incidentTopics, incidentPhotoEvents } from "@/app/lib/incidentCase";
import { canViewBookingEvidencePhoto } from "@/app/lib/bookingEvidenceVisibility";
import { canUploadBookingEvidence } from "@/app/lib/bookingEvidence";
import { canClaimNotReturned, claimReasonFromReturnIssue, isNotReturnedClaimReason, readDepositClaim } from "@/app/lib/depositClaim";
import { hasReturnReceipt, readIssue } from "@/app/lib/logisticsIssue";
import { canReceive } from "@/app/lib/logistics";
import LogisticsIssuePanel from "@/app/bookings/[id]/_components/LogisticsIssuePanel";
import BookingEvidencePhotos from "@/app/bookings/[id]/_components/BookingEvidencePhotos";
import DepositClaimPanel from "@/app/bookings/[id]/_components/DepositClaimPanel";
import BookingActionFeedback from "@/app/bookings/[id]/_components/BookingActionFeedback";

export const dynamic = "force-dynamic";
const money = (cents: number | null) => cents === null ? "—" : new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(cents / 100);

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/account/incidents/${id}`)}`);
  const userId = session.user.id;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { incidents: { include: { evidence: { orderBy: { createdAt: "asc" } } } }, listing: { select: { title: true } } } });
  if (!booking || ![booking.ownerId, booking.renterId].includes(userId) || (!hasIncident(booking) && booking.incidents.length === 0)) notFound();
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
    ...incidentPhotoEvents(booking, visiblePhotos),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const deliveryCompleted = booking.shippingStatus === "DELIVERED" && ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.deliveryConfirmationStatus);
  const returnCompleted = ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.returnConfirmationStatus);
  const settlementPending = !!booking.settlementDecision && !booking.settlementCompletedAt;
  const canManageDeposit = isOwner && booking.paymentStatus === "PAID" && deliveryCompleted && (booking.depositCents ?? 0) > 0 && (booking.depositStatus === "PAID" || settlementPending);
  const canPropose = isOwner && booking.paymentStatus === "PAID" && booking.depositStatus === "PAID" && !booking.settlementDecision && !booking.settlementCompletedAt && deliveryCompleted && ["SHIPPED", "DELIVERED"].includes(booking.returnStatus) && returnIssue?.reason !== "NOT_RECEIVED";
  const canProposeNotReturned = isOwner && booking.paymentStatus === "PAID" && booking.depositStatus === "PAID" && !booking.settlementDecision && !booking.settlementCompletedAt && canClaimNotReturned(booking);

  return <main className="mx-auto max-w-4xl space-y-6 p-4">
    <nav className="flex flex-wrap gap-4 text-sm"><Link href="/account/incidents" className="underline">← Moje zgłoszenia</Link><Link href={`/bookings/${encodeURIComponent(id)}`} className="underline">Rezerwacja #{booking.bookingNumber}</Link></nav>
    <BookingActionFeedback bookingId={id} />
    <header className="surface-card p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Zgłoszenie · rezerwacja #{booking.bookingNumber}</h1><p className="text-gray-600">{booking.listing.title} · {isOwner ? "Właściciel" : "Najemca"}</p></div><span className={`rounded-full px-3 py-1 text-sm font-semibold ${state.needsAction ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{state.label}</span></div>
      <div className="flex flex-wrap gap-2">{incidentTopics(booking).map(topic => <span key={topic.label} className="rounded border px-2 py-1 text-xs">{topic.label}: {topic.detail}</span>)}</div>
      <div className={`rounded-xl p-4 ${state.needsAction ? "bg-violet-50 text-violet-950" : "bg-slate-50 text-slate-700"}`}><p className="mb-1 text-sm font-semibold">{state.needsAction ? "Co teraz zrobić?" : "Aktualny stan"}</p><p className="text-sm leading-relaxed">{state.next}</p>{state.needsAction && <a href={booking.incidents.length ? "#incident-section" : claim ? "#incident-deposit" : booking.deliveryIssue !== null ? "#incident-delivery" : "#incident-return"} className="mt-3 inline-flex rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800">Przejdź do odpowiedzi ↓</a>}</div>
    </header>

    <IncidentTimeline events={timeline.map(event => ({ ...event, at: event.at.toISOString() }))} />
    <BookingIncidents bookingId={id} userId={userId} />

    {!booking.incidents.some(i => i.stage === "DELIVERY") && (booking.deliveryIssue !== null || booking.deliveryConfirmationStatus === "DISPUTED") && <details open className="surface-card p-5" aria-labelledby="incident-delivery">
      <summary id="incident-delivery" className="cursor-pointer font-semibold">Dostawa — szczegóły i dowody</summary><div className="mt-4 space-y-3">
      <LogisticsIssuePanel bookingId={id} stage="DELIVERY" stored={booking.deliveryIssue} disputed={booking.deliveryConfirmationStatus === "DISPUTED"} recipientId={booking.renterId} userId={userId} canResolve={canReceive({ ...booking, deliveryConfirmationStatus: "AWAITING_CONFIRMATION" }, "DELIVERY")}
        facts={{ expectedAt: booking.startDate, sentAt: booking.shippedAt, receivedAt: booking.deliveredAt, carrier: booking.carrier, trackingNumber: booking.trackingNumber, ownerPhotos: visiblePhotos.filter(photo => photo.stage === "DELIVERY" && photo.uploaderId === booking.ownerId).length, renterPhotos: visiblePhotos.filter(photo => photo.stage === "DELIVERY" && photo.uploaderId === booking.renterId).length, rentCents: booking.rentAmountCents, depositCents: booking.depositCents }} />
      <BookingEvidencePhotos bookingId={id} stage="DELIVERY" userId={userId} ownerId={booking.ownerId} renterId={booking.renterId} canUpload={canUploadBookingEvidence(booking, "DELIVERY", userId)} photos={visiblePhotos.filter(photo => photo.stage === "DELIVERY").map(photo => ({ ...photo, createdAt: photo.createdAt.toISOString() }))} />
    </div></details>}

    {(booking.returnIssue !== null || booking.returnConfirmationStatus === "DISPUTED") && <details open={!booking.incidents.some(i => i.stage === "RETURN")} className="surface-card p-5" aria-labelledby={booking.incidents.some(i => i.stage === "RETURN") ? "return-evidence" : "incident-return"}>
      <summary id={booking.incidents.some(i => i.stage === "RETURN") ? "return-evidence" : "incident-return"} className="cursor-pointer font-semibold">Zwrot — szczegóły i dowody</summary><div className="mt-4 space-y-3">
      <LogisticsIssuePanel bookingId={id} stage="RETURN" stored={booking.returnIssue} disputed={booking.returnConfirmationStatus === "DISPUTED"} recipientId={booking.ownerId} userId={userId} receiptConfirmed={booking.returnConfirmedAt !== null} hasDepositClaim={claim !== null} claimNotReturned={isNotReturnedClaimReason(claim?.reasonCode ?? "")} canResolve={booking.depositClaim === null && canReceive({ ...booking, returnConfirmationStatus: "AWAITING_CONFIRMATION" }, "RETURN")}
        facts={{ expectedAt: booking.endDate, sentAt: booking.returnShippedAt, receivedAt: booking.returnDeliveredAt, carrier: booking.returnCarrier, trackingNumber: booking.returnTrackingNumber, ownerPhotos: visiblePhotos.filter(photo => photo.stage === "RETURN" && photo.uploaderId === booking.ownerId).length, renterPhotos: visiblePhotos.filter(photo => photo.stage === "RETURN" && photo.uploaderId === booking.renterId).length, rentCents: booking.rentAmountCents, depositCents: booking.depositCents }} />
      <BookingEvidencePhotos bookingId={id} stage="RETURN" userId={userId} ownerId={booking.ownerId} renterId={booking.renterId} canUpload={canUploadBookingEvidence(booking, "RETURN", userId)} photos={visiblePhotos.filter(photo => photo.stage === "RETURN").map(photo => ({ ...photo, createdAt: photo.createdAt.toISOString() }))} />
    </div></details>}

    {(booking.depositCents ?? 0) > 0 && (booking.returnIssue !== null || booking.depositClaim !== null || booking.returnConfirmationStatus === "DISPUTED") && <section className="rounded-xl border bg-white p-5 space-y-4" aria-labelledby="incident-deposit">
      <h2 id="incident-deposit" className="text-lg font-semibold">Kaucja i decyzja</h2>
      <p className="text-sm">Wpłacona kaucja: <strong>{money(booking.depositCents)}</strong> · Zwrócono: <strong>{money(booking.depositRefundedCents)}</strong> · Zatrzymano: <strong>{money(booking.depositRetainedCents)}</strong></p>
      <DepositClaimPanel bookingId={id} depositCents={booking.depositCents ?? 0} claim={claim} hasClaim={booking.depositClaim !== null} isOwner={isOwner} isRenter={isRenter} returnCompleted={returnCompleted} receiptKnown={hasReturnReceipt(booking)} canPropose={canPropose} canProposeNotReturned={canProposeNotReturned} initialReason={returnIssue?.description ?? ""} initialReasonCode={claimReasonFromReturnIssue(returnIssue?.reason)} completed={!!booking.settlementCompletedAt} settling={settlementPending} canRefund={canManageDeposit && !booking.settlementDecision} />

    </section>}

  </main>;
}
