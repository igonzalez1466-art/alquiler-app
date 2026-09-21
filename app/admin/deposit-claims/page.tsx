import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { prisma } from "@/app/lib/prisma";
import { notFound } from "next/navigation";
import { readDepositClaim } from "@/app/lib/depositClaim";
import DepositClaimPanel from "@/app/bookings/[id]/_components/DepositClaimPanel";

export default async function DepositClaimsPage() {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) return notFound();
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN") return notFound();
  const bookings = await prisma.booking.findMany({
    where: { OR: ["DISPUTED", "APPROVED", "PENDING"].map(status => ({ depositClaim: { path: ["status"], equals: status } })), settlementCompletedAt: null },
    orderBy: { createdAt: "asc" }, take: 100,
    select: { id: true, bookingNumber: true, ownerId: true, renterId: true, depositClaim: true, depositCents: true, settlementDecision: true, settlementCompletedAt: true, listing: { select: { title: true } } },
  });
  return <div className="space-y-5">
    <h2 className="text-xl font-semibold">Roszczenia dotyczące kaucji</h2>
    <p>Otwarte sprawy (maksymalnie 100). Sprawdź rezerwację i dowody przed rozstrzygnięciem. Propozycje oczekujące na najemcę nie mogą być rozstrzygane jako spór.</p>
    {!bookings.length && <p>Brak otwartych spraw.</p>}
    {bookings.map(b => <section key={b.id} className="rounded border p-3 space-y-3">
      <h3 className="font-semibold">#{b.bookingNumber} · {b.listing.title}</h3>
      <DepositClaimPanel bookingId={b.id} depositCents={b.depositCents ?? 0} claim={readDepositClaim(b.depositClaim)} hasClaim
        isOwner={b.ownerId === session.user.id} isRenter={b.renterId === session.user.id}
        isSupport={b.ownerId !== session.user.id && b.renterId !== session.user.id}
        completed={!!b.settlementCompletedAt} settling={!!b.settlementDecision} />
    </section>)}
  </div>;
}
