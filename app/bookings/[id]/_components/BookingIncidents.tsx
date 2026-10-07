import { lateDeliverySuggestion } from "@/app/lib/lateDelivery";
import { rentalCalendarDate } from "@/app/lib/rentalCalendarDate";
import { prisma } from "@/app/lib/prisma";
import BookingEvidencePhotos from "./BookingEvidencePhotos";
import { canUploadBookingEvidence } from "@/app/lib/bookingEvidence";
import { canViewBookingEvidencePhoto } from "@/app/lib/bookingEvidenceVisibility";
import IncidentPanel from "./IncidentPanel";

export default async function BookingIncidents({ bookingId, userId }: { bookingId: string; userId: string }) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { incidents: { include: { evidence: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } } } });
  if (!b || ![b.ownerId, b.renterId].includes(userId)) return null;
  const paid = b.paymentStatus === "PAID" && !b.cancelledAt && b.status !== "CANCELLED";
  const received = !!b.deliveryConfirmedAt || ["CONFIRMED", "AUTO_CONFIRMED"].includes(b.deliveryConfirmationStatus);
  const photos = b.deliveryIssue !== null || b.incidents.some(i => i.stage === "DELIVERY")
    ? await prisma.bookingEvidencePhoto.findMany({ where: { bookingId, stage: "DELIVERY" }, select: { id: true, stage: true, uploaderId: true, createdAt: true }, orderBy: { createdAt: "asc" } }) : [];
  const visiblePhotos = photos.filter(photo => canViewBookingEvidencePhoto(b, photo, userId));
  const deliveryPhotos = (b.deliveryIssue !== null || b.incidents.some(i => i.stage === "DELIVERY"))
    ? <BookingEvidencePhotos oneBatch bookingId={bookingId} stage="DELIVERY" userId={userId} ownerId={b.ownerId} renterId={b.renterId}
      canUpload={canUploadBookingEvidence(b, "DELIVERY", userId)}
      photos={visiblePhotos.map(photo => ({ id: photo.id, uploaderId: photo.uploaderId, createdAt: photo.createdAt.toISOString() }))} /> : null;
  return <IncidentPanel deliveryPhotos={deliveryPhotos} bookingId={bookingId} userId={userId} isOwner={b.ownerId === userId} rentCents={b.rentAmountCents ?? b.amountCents ?? 0}
    canOpenDelivery={paid && b.renterId === userId && !received && !b.rentSettlement && !b.ownerTransferId && b.deliveryIssue === null}
    canOpenReturn={paid && b.ownerId === userId && received && b.returnIssue === null}
    cases={b.incidents.map(i => ({ ...i, reportedDeliveryDate: i.reportedDeliveryDate ? rentalCalendarDate(i.reportedDeliveryDate) : null, lateDelivery: i.reason === "LATE_DELIVERY" && i.reportedDeliveryDate ? lateDeliverySuggestion(b.startDate, b.endDate, rentalCalendarDate(i.reportedDeliveryDate), b.rentAmountCents ?? b.amountCents ?? 0) : null, createdAt: i.createdAt.toISOString(), resolvedAt: i.resolvedAt?.toISOString() ?? null, evidence: i.evidence.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })) }))} />;
}
