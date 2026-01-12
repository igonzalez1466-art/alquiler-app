// app/users/[id]/page.tsx
import { prisma } from "@/app/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

type PageProps = { params: Promise<{ id: string }> };

const roleLabel: Record<"OWNER" | "RENTER", string> = {
  OWNER: "Jako właściciel",
  RENTER: "Jako najemca",
};

// ✅ plural polaco: 1 ocena, 2-4 oceny, 5+ ocen (con 12-14 excepción)
function pluralizeOcena(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (count === 1) return "ocena";
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "oceny";
  return "ocen";
}

function Stars({ value }: { value: number }) {
  const v = Number.isFinite(value) ? value : 0;
  const full = Math.round(v);
  return (
    <span aria-label={`${v.toFixed(1)} na 5`}>
      {"★".repeat(full)}
      {"☆".repeat(5 - full)}
      <span className="ml-1 text-xs text-gray-500">({v.toFixed(1)})</span>
    </span>
  );
}

export default async function UserProfile({ params }: PageProps) {
  const { id } = await params;

  // ✅ quién está viendo la página
  const session = await getServerSession(authConfig);
  const viewerId = session?.user?.id ?? null;
  const isMe = !!viewerId && viewerId === id;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, image: true },
  });

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="mb-2 text-red-600">Nie znaleziono użytkownika.</p>
        <Link href="/account" className="text-blue-600 underline">
          ← Wróć do mojego konta
        </Link>
      </div>
    );
  }

  // Medias por rol
  const [ownerAgg, renterAgg] = await Promise.all([
    prisma.review.aggregate({
      where: { revieweeId: id, role: "OWNER" },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.review.aggregate({
      where: { revieweeId: id, role: "RENTER" },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);

  // Últimas opiniones
  const latest = await prisma.review.findMany({
    where: { revieweeId: id },
    include: {
      reviewer: { select: { id: true, name: true } },
      booking: {
        select: {
          id: true,
          listing: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const sections = [
    {
      key: "OWNER" as const,
      label: roleLabel.OWNER,
      avg: ownerAgg._avg.rating ?? 0,
      count: ownerAgg._count.rating ?? 0,
    },
    {
      key: "RENTER" as const,
      label: roleLabel.RENTER,
      avg: renterAgg._avg.rating ?? 0,
      count: renterAgg._count.rating ?? 0,
    },
  ];

  // ✅ textos correctos cuando NO es tu perfil (neutral)
  const aboutPrefix = isMe ? "O Tobie" : "O tym użytkowniku";
  const backHref = isMe ? "/account" : "/bookings";
  const backLabel = isMe ? "← Wróć do mojego konta" : "← Wróć";

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Link href={backHref} className="text-blue-600 underline">
        {backLabel}
      </Link>

      {/* Cabecera */}
      <div className="flex items-center gap-4">
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name ?? "Użytkownik"}
            width={64}
            height={64}
            className="rounded-full border"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-gray-200 grid place-items-center text-gray-500">
            👤
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold">{user.name ?? "Użytkownik"}</h1>

          {/* ✅ Recomendado: NO mostrar email si no es tu perfil */}
          {isMe ? (
            <p className="text-gray-600 text-sm">{user.email ?? "—"}</p>
          ) : (
            <p className="text-gray-600 text-sm">Profil użytkownika</p>
          )}
        </div>
      </div>

      {/* Medias */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sections.map((s) => (
          <div key={s.key} className="rounded border bg-white p-4">
            <p className="text-sm text-gray-600">{s.label}</p>

            {s.count > 0 ? (
              <div className="mt-1">
                <Stars value={s.avg} />{" "}
                <span className="text-sm text-gray-500">
                  · {s.count} {pluralizeOcena(s.count)}
                </span>
              </div>
            ) : (
              <p className="text-gray-500 mt-1">Brak ocen.</p>
            )}
          </div>
        ))}
      </section>

      {/* Últimas opiniones */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ostatnie opinie</h2>

        {latest.length === 0 ? (
          <p className="text-gray-500">Brak opinii.</p>
        ) : (
          <ul className="space-y-3">
            {latest.map((r) => {
              const listing = r.booking?.listing;

              return (
                <li key={r.id} className="rounded border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      <strong>{r.reviewer?.name ?? "Użytkownik"}</strong>{" "}
                      {r.role === "OWNER"
                        ? `· ${aboutPrefix} jako właścicielu`
                        : `· ${aboutPrefix} jako najemcy`}
                      {listing && (
                        <>
                          {" · "}
                          <Link
                            href={`/listing/${listing.id}`}
                            className="text-indigo-700 hover:underline"
                          >
                            {listing.title}
                          </Link>
                        </>
                      )}
                    </div>

                    <span className="text-sm" aria-label={`${r.rating} na 5`}>
                      {"★".repeat(r.rating)}
                      {"☆".repeat(5 - r.rating)}
                    </span>
                  </div>

                  {r.comment && (
                    <p className="mt-2 text-sm text-gray-800">{r.comment}</p>
                  )}

                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(r.createdAt).toLocaleDateString("pl-PL")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
