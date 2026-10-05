import Link from "next/link";
import BookingEvidencePhotos from "@/app/bookings/[id]/_components/BookingEvidencePhotos";
import { requireAdmin } from "../_lib/requireAdmin";
import { prisma } from "@/app/lib/prisma";
import { incidentReasons } from "@/app/lib/incidentPolicy";
import { restrictIncidentAccount } from "./actions";

export const dynamic = "force-dynamic";
export default async function AdminIncidents() {
  const session = await requireAdmin();
  const incidents = await prisma.incident.findMany({ take: 100, orderBy: { createdAt: "desc" }, include: { evidence: { orderBy: { createdAt: "asc" } }, againstUser: { select: { id: true, name: true, bookingRestrictedAt: true } }, booking: { select: { id: true, bookingNumber: true, ownerId: true, renterId: true, evidencePhotos: { select: { id: true, stage: true, uploaderId: true, createdAt: true } } } } } });
  return <main className="mx-auto max-w-4xl space-y-4 p-4"><Link href="/admin" className="underline">← Panel administracyjny</Link><h1 className="text-2xl font-bold">Incydenty — historia i bezpieczeństwo kont</h1><p className="text-sm">Zgłoszenie nie jest dowodem winy i nie obniża automatycznie oceny. Obsługa może po analizie ograniczyć nowe rezerwacje i zapisać uzasadnienie. Nie ustala odszkodowań. Wypłaty i zwroty za dostawę wymagają porozumienia stron.</p>
    {incidents.map(i => <article key={i.id} className="space-y-3 rounded border bg-white p-4"><h2 className="font-semibold">#{i.booking.bookingNumber} · {i.stage} · {incidentReasons[i.reason]} · {i.status}</h2><p className="whitespace-pre-wrap text-sm">{i.description}</p><p className="text-sm">Konto: {i.againstUser.name ?? i.againstUserId} · {i.againstUser.bookingRestrictedAt ? "Nowe rezerwacje ograniczone" : "Bez ograniczenia"}</p>{i.evidence.map(e => <p key={e.id} className="whitespace-pre-wrap rounded bg-gray-50 p-2 text-sm">{e.text}</p>)}<BookingEvidencePhotos bookingId={i.bookingId} stage={i.stage} userId={session.user.id!} ownerId={i.booking.ownerId} renterId={i.booking.renterId} canUpload={false} photos={i.booking.evidencePhotos.filter(p => p.stage === i.stage).map(p => ({ ...p, createdAt: p.createdAt.toISOString() }))} /><p className="text-xs">Zdjęcia i tracking pozostają w dokumentacji rezerwacji. Dane dla organów udostępniaj po zweryfikowaniu podstawy i zakresu żądania.</p>
      <form action={restrictIncidentAccount} className="space-y-2"><input type="hidden" name="incidentId" value={i.id} /><label className="block text-sm">Uzasadnienie<textarea name="note" required maxLength={2000} className="block w-full rounded border p-2" /></label><button name="operation" value={i.againstUser.bookingRestrictedAt ? "restore" : "restrict"} className="rounded border px-3 py-2 text-sm">{i.againstUser.bookingRestrictedAt ? "Przywróć nowe rezerwacje" : "Ogranicz nowe rezerwacje"}</button></form>
    </article>)}{incidents.length === 0 && <p>Brak zgłoszeń.</p>}
  </main>;
}
