import { prisma } from "@/app/lib/prisma";
import IncidentPanel from "./IncidentPanel";

export default async function BookingIncidents({ bookingId, userId }: { bookingId: string; userId: string }) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { incidents: { include: { evidence: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" } } } });
  if (!b || ![b.ownerId, b.renterId].includes(userId)) return null;
  const paid = b.paymentStatus === "PAID" && !b.cancelledAt && b.status !== "CANCELLED";
  const received = !!b.deliveryConfirmedAt || ["CONFIRMED", "AUTO_CONFIRMED"].includes(b.deliveryConfirmationStatus);
  return <IncidentPanel bookingId={bookingId} userId={userId} isOwner={b.ownerId === userId} rentCents={b.rentAmountCents ?? b.amountCents ?? 0}
    canOpenDelivery={paid && b.renterId === userId && !received && !b.rentSettlement && !b.ownerTransferId && b.deliveryIssue === null}
    canOpenReturn={paid && b.ownerId === userId && received && b.returnIssue === null}
    cases={b.incidents.map(i => ({ ...i, createdAt: i.createdAt.toISOString(), resolvedAt: i.resolvedAt?.toISOString() ?? null, evidence: i.evidence.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })) }))} />;
}
