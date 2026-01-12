// app/bookings/page.tsx
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import Link from "next/link";

function bookingNumber(id: string) {
  return `BK-${id.slice(0, 8)}`;
}


/* ============ Helpers ============ */
function formatRange(a: Date, b: Date) {
  const f = (d: Date) =>
    d.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  return `${f(a)} — ${f(b)}`;
}

function cx(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

function plRezerwacje(n: number) {
  if (n === 1) return "rezerwacja";
  if (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)) {
    return "rezerwacje";
  }
  return "rezerwacji";
}

const statusLabel: Record<"PENDING" | "CONFIRMED" | "CANCELLED", string> = {
  PENDING: "Oczekująca",
  CONFIRMED: "Potwierdzona",
  CANCELLED: "Odrzucona",
};

const statusClass: Record<"PENDING" | "CONFIRMED" | "CANCELLED", string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
};

function StatusBadge({
  status,
}: {
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | string;
}) {
  const cls =
    (statusClass as any)[status] ??
    "bg-gray-100 text-gray-800 border-gray-200";
  const label = (statusLabel as any)[status] ?? status;

  return (
    <span className={cx("text-xs px-2 py-1 rounded border", cls)}>{label}</span>
  );
}

type SP = {
  mStatus?: "all" | "PENDING" | "CONFIRMED" | "CANCELLED";
  mFrom?: string;
  mTo?: string;
  mSort?: "start_desc" | "start_asc" | "created_desc" | "created_asc";

  oStatus?: "all" | "PENDING" | "CONFIRMED" | "CANCELLED";
  oFrom?: string;
  oTo?: string;
  oSort?: "start_desc" | "start_asc" | "created_desc" | "created_asc";
};

const parseDay = (s?: string) => {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
};

const endOfDay = (d: Date) => {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
};

/* ============ Server Action: crear review ============ */
async function createReviewAction(formData: FormData) {
  "use server";
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) throw new Error("No autorizado");

  const reviewerId = session.user.id;
  const bookingId = String(formData.get("bookingId") || "");
  const role = String(formData.get("role") || ""); // "OWNER" | "RENTER"
  const rating = Number(formData.get("rating") || "0");
  const comment = String(formData.get("comment") || "").trim();

  if (!bookingId || !["OWNER", "RENTER"].includes(role))
    throw new Error("Datos inválidos");
  if (!(rating >= 1 && rating <= 5)) throw new Error("Rating fuera de rango");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { listing: { select: { userId: true } } },
  });
  if (!booking) throw new Error("Reserva no encontrada");

  const now = new Date();
  const isParticipant =
    booking.renterId === reviewerId || booking.listing.userId === reviewerId;

  if (!isParticipant) throw new Error("No autorizado");
  if (booking.status !== "CONFIRMED" || booking.endDate > now) {
    throw new Error("Solo se puede valorar reservas confirmadas y finalizadas");
  }

  let revieweeId: string;
  if (role === "OWNER") {
    if (booking.renterId !== reviewerId)
      throw new Error("Rol no válido para esta reserva");
    revieweeId = booking.listing.userId;
  } else {
    if (booking.listing.userId !== reviewerId)
      throw new Error("Rol no válido para esta reserva");
    revieweeId = booking.renterId;
  }

  const existing = await prisma.review.findFirst({
    where: { bookingId, reviewerId, revieweeId },
    select: { id: true },
  });
  if (existing) throw new Error("Ya has valorado en esta reserva");

  await prisma.review.create({
    data: {
      bookingId,
      reviewerId,
      revieweeId,
      role: role as any,
      rating,
      comment: comment || null,
    },
  });
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<SP> | SP;
}) {
  const p: SP = (await searchParams) ?? {};

  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-red-600 mb-2">
          Musisz się zalogować, aby zobaczyć swoje rezerwacje.
        </p>
        <Link href="/api/auth/signin" className="text-blue-600 underline">
          Zaloguj się
        </Link>
      </div>
    );
  }

  /* ====== Filtros "Reservas que he hecho" ====== */
  const mStatus = (p.mStatus as SP["mStatus"]) ?? "all";
  const mFrom = parseDay(p.mFrom);
  const mTo = parseDay(p.mTo) ? endOfDay(parseDay(p.mTo)!) : undefined;
  const mSort = (p.mSort as SP["mSort"]) ?? "start_desc";

  const madeWhere: any = { renterId: userId };
  if (mStatus !== "all") madeWhere.status = mStatus;
  if (mFrom || mTo) {
    madeWhere.startDate = { gte: mFrom ?? undefined, lte: mTo ?? undefined };
  }

  let madeOrderBy: any = { startDate: "desc" as const };
  if (mSort === "start_asc") madeOrderBy = { startDate: "asc" };
  if (mSort === "created_desc") madeOrderBy = { createdAt: "desc" };
  if (mSort === "created_asc") madeOrderBy = { createdAt: "asc" };

  /* ====== Filtros "Reservas en mis anuncios" ====== */
  const oStatus = (p.oStatus as SP["oStatus"]) ?? "all";
  const oFrom = parseDay(p.oFrom);
  const oTo = parseDay(p.oTo) ? endOfDay(parseDay(p.oTo)!) : undefined;
  const oSort = (p.oSort as SP["oSort"]) ?? "start_desc";

  const ownerWhere: any = { listing: { userId } };
  if (oStatus !== "all") ownerWhere.status = oStatus;
  if (oFrom || oTo) {
    ownerWhere.startDate = { gte: oFrom ?? undefined, lte: oTo ?? undefined };
  }

  let ownerOrderBy: any = { startDate: "desc" as const };
  if (oSort === "start_asc") ownerOrderBy = { startDate: "asc" };
  if (oSort === "created_desc") ownerOrderBy = { createdAt: "desc" };
  if (oSort === "created_asc") ownerOrderBy = { createdAt: "asc" };

  /* ====== Queries ====== */
  const [asRenter, asOwner] = await Promise.all([
    prisma.booking.findMany({
      where: madeWhere,
      include: {
        listing: { select: { id: true, title: true, userId: true } },
        reviews: {
          select: {
            id: true,
            reviewerId: true,
            revieweeId: true,
            rating: true,
            role: true,
          },
        },
      },
      orderBy: madeOrderBy,
    }),
    prisma.booking.findMany({
      where: ownerWhere,
      include: {
        listing: { select: { id: true, title: true, userId: true } },
        renter: { select: { id: true, name: true } },
        reviews: {
          select: {
            id: true,
            reviewerId: true,
            revieweeId: true,
            rating: true,
            role: true,
          },
        },
      },
      orderBy: ownerOrderBy,
    }),
  ]);

  const now = new Date();

  const preserveM = new URLSearchParams({
    mStatus: p.mStatus ?? "all",
    mFrom: p.mFrom ?? "",
    mTo: p.mTo ?? "",
    mSort: p.mSort ?? "start_desc",
  }).toString();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-10">
      <h1 className="text-2xl font-bold">Rezerwacje</h1>

      {/* ===================== COMO INQUILINO ===================== */}
      <section>
        <details className="space-y-3 w-full" open>
          <summary className="flex items-center justify-between cursor-pointer list-none border-b pb-2 mb-2 [&::-webkit-details-marker]:hidden">
            <span className="text-xl font-semibold">Moje rezerwacje</span>
            <span className="text-sm text-gray-500">
              {asRenter.length} {plRezerwacje(asRenter.length)}
            </span>
          </summary>

          <div className="space-y-3">
            {/* Filtros (prefijo m*) */}
            <form
              method="GET"
              className="w-full rounded border p-3 grid grid-cols-2 md:grid-cols-6 gap-2 bg-white"
            >
              <label className="block">
                <span className="text-xs text-gray-600">Status</span>
                <select
                  name="mStatus"
                  defaultValue={mStatus}
                  className="border rounded p-2 w-full"
                >
                  <option value="all">Wszystkie</option>
                  <option value="PENDING">Oczekujące</option>
                  <option value="CONFIRMED">Zaakceptowane</option>
                  <option value="CANCELLED">Odrzucone</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-600">Od</span>
                <input
                  type="date"
                  name="mFrom"
                  defaultValue={p.mFrom ?? ""}
                  className="border rounded p-2 w-full"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-600">Do</span>
                <input
                  type="date"
                  name="mTo"
                  defaultValue={p.mTo ?? ""}
                  className="border rounded p-2 w-full"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs text-gray-600">Sortowanie</span>
                <select
                  name="mSort"
                  defaultValue={mSort}
                  className="border rounded p-2 w-full"
                >
                  <option value="start_desc">Początek ↓</option>
                  <option value="start_asc">Początek ↑</option>
                  <option value="created_desc">Data utworzenia ↓</option>
                  <option value="created_asc">Data utworzenia ↑</option>
                </select>
              </label>

              {/* Conserva filtros de la otra sección */}
              <input type="hidden" name="oStatus" value={p.oStatus ?? "all"} />
              <input type="hidden" name="oFrom" value={p.oFrom ?? ""} />
              <input type="hidden" name="oTo" value={p.oTo ?? ""} />
              <input
                type="hidden"
                name="oSort"
                value={p.oSort ?? "start_desc"}
              />

              {/* Botones dentro del cuadro */}
              <div className="col-span-2 md:col-span-6 flex flex-wrap items-center justify-end gap-2">
                <button className="bg-indigo-600 text-white rounded px-4 py-2 whitespace-nowrap">
                  Zastosuj
                </button>
                <Link
                  href="/bookings"
                  className="text-center border rounded px-4 py-2 whitespace-nowrap"
                >
                  Wyczyść filtry
                </Link>
              </div>
            </form>

            {asRenter.length === 0 ? (
              <p className="text-gray-500">
                Brak rezerwacji dla wybranych filtrów.
              </p>
            ) : (
              <ul className="space-y-3">
                {asRenter.map((b) => {
                  const iCanReview =
                    b.status === "CONFIRMED" &&
                    b.endDate < now &&
                    !b.reviews.some(
                      (r) => r.reviewerId === userId && r.role === "OWNER"
                    );

                  const myExisting = b.reviews.find(
                    (r) => r.reviewerId === userId && r.role === "OWNER"
                  );

                  return (
                    <li
                      key={b.id}
                      className="p-4 border rounded bg-white shadow-sm"
                    >
                      {/* ✅ Layout seguro en móvil */}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        {/* izquierda */}
                        <div className="min-w-0">
<div className="flex items-center gap-2 min-w-0">
  <Link
    href={`/listing/${b.listingId}`}
    className="text-blue-700 hover:underline font-medium block truncate"
  >
    {b.listing?.title ?? "Anuncio"}
  </Link>

  <Link
    href={`/bookings/${b.id}`}
    className="text-xs text-gray-500 whitespace-nowrap hover:underline"
    title="Numer rezerwacji"
  >
    {bookingNumber(b.id)}
  </Link>
</div>


                          <div className="text-sm text-gray-600 mt-1">
                            {formatRange(b.startDate, b.endDate)}
                          </div>
                        </div>

                        {/* derecha */}
                        <div className="w-full sm:w-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end">
                          <div className="self-start sm:self-auto">
                            <StatusBadge status={b.status} />
                          </div>

                          <Link
                            href={`/bookings/${b.id}`}
                            className="w-full sm:w-auto px-3 py-2 rounded border text-gray-700 hover:bg-gray-50 text-center whitespace-nowrap"
                          >
                            Zobacz szczegóły
                          </Link>
                        </div>
                      </div>

                      {myExisting ? (
                        <div className="mt-3 text-sm text-gray-700">
                          Twoja ocena właściciela:{" "}
                          <strong>{myExisting.rating}/5</strong>
                        </div>
                      ) : iCanReview ? (
                        <form
                          action={createReviewAction}
                          className="mt-3 grid grid-cols-1 sm:grid-cols-6 gap-2"
                        >
                          <input type="hidden" name="bookingId" value={b.id} />
                          <input type="hidden" name="role" value="OWNER" />

                          <label className="sm:col-span-1">
                            <span className="text-xs text-gray-600">Ocena</span>
                            <select
                              name="rating"
                              required
                              className="border rounded p-2 w-full"
                              defaultValue=""
                            >
                              <option value="" disabled>
                                —
                              </option>
                              <option value="5">5</option>
                              <option value="4">4</option>
                              <option value="3">3</option>
                              <option value="2">2</option>
                              <option value="1">1</option>
                            </select>
                          </label>

                          <label className="sm:col-span-4">
                            <span className="text-xs text-gray-600">
                              Komentarz (opcjonalnie)
                            </span>
                            <input
                              name="comment"
                              placeholder="Jak oceniasz to doświadczenie?"
                              className="border rounded p-2 w-full"
                            />
                          </label>

                          <div className="sm:col-span-1 flex items-end">
                            <button className="w-full bg-emerald-600 text-white rounded px-3 py-2">
                              Oceń
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </details>
      </section>

      {/* ===================== COMO PROPIETARIO ===================== */}
      <section>
        <details className="space-y-3 w-full">
          <summary className="flex items-center justify-between cursor-pointer list-none border-b pb-2 mb-2 [&::-webkit-details-marker]:hidden">
            <span className="text-xl font-semibold">
              Rezerwacje w moich ogłoszeniach
            </span>
            <span className="text-sm text-gray-500">
              {asOwner.length} {plRezerwacje(asOwner.length)}
            </span>
          </summary>

          <div className="space-y-3">
            {/* Filtros (prefijo o*) */}
            <form
              method="GET"
              className="w-full rounded border p-3 grid grid-cols-2 md:grid-cols-6 gap-2 bg-white"
            >
              {/* Mantén filtros m* al enviar o* */}
              <input type="hidden" name="mStatus" value={p.mStatus ?? "all"} />
              <input type="hidden" name="mFrom" value={p.mFrom ?? ""} />
              <input type="hidden" name="mTo" value={p.mTo ?? ""} />
              <input
                type="hidden"
                name="mSort"
                value={p.mSort ?? "start_desc"}
              />

              <label className="block">
                <span className="text-xs text-gray-600">Status</span>
                <select
                  name="oStatus"
                  defaultValue={oStatus}
                  className="border rounded p-2 w-full"
                >
                  <option value="all">Wszystkie</option>
                  <option value="PENDING">Oczekujące</option>
                  <option value="CONFIRMED">Zaakceptowane</option>
                  <option value="CANCELLED">Odrzucone</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-600">Od</span>
                <input
                  type="date"
                  name="oFrom"
                  defaultValue={p.oFrom ?? ""}
                  className="border rounded p-2 w-full"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-600">Do</span>
                <input
                  type="date"
                  name="oTo"
                  defaultValue={p.oTo ?? ""}
                  className="border rounded p-2 w-full"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs text-gray-600">Sortowanie</span>
                <select
                  name="oSort"
                  defaultValue={oSort}
                  className="border rounded p-2 w-full"
                >
                  <option value="start_desc">Początek ↓</option>
                  <option value="start_asc">Początek ↑</option>
                  <option value="created_desc">Data utworzenia ↓</option>
                  <option value="created_asc">Data utworzenia ↑</option>
                </select>
              </label>

              {/* Botones dentro del cuadro */}
              <div className="col-span-2 md:col-span-6 flex flex-wrap items-center justify-end gap-2">
                <button className="bg-indigo-600 text-white rounded px-4 py-2 whitespace-nowrap">
                  Zastosuj
                </button>
                <Link
                  href={`/bookings?${preserveM}`}
                  className="text-center border rounded px-4 py-2 whitespace-nowrap"
                >
                  Wyczyść filtry
                </Link>
              </div>
            </form>

            {asOwner.length === 0 ? (
              <p className="text-gray-500">
                Brak rezerwacji dla wybranych filtrów.
              </p>
            ) : (
              <ul className="space-y-3">
                {asOwner.map((b) => {
                  const iCanReview =
                    b.status === "CONFIRMED" &&
                    b.endDate < now &&
                    !b.reviews.some(
                      (r) => r.reviewerId === userId && r.role === "RENTER"
                    );

                  const myExisting = b.reviews.find(
                    (r) => r.reviewerId === userId && r.role === "RENTER"
                  );

                  return (
                    <li
                      key={b.id}
                      className="p-4 border rounded bg-white shadow-sm"
                    >
                      {/* ✅ Layout seguro en móvil */}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        {/* izquierda */}
                        <div className="min-w-0 space-y-1">
<div className="flex items-center gap-2 min-w-0">
  <Link
    href={`/listing/${b.listingId}`}
    className="text-blue-700 hover:underline font-medium block truncate"
  >
    {b.listing?.title ?? "Anuncio"}
  </Link>

  <Link
    href={`/bookings/${b.id}`}
    className="text-xs text-gray-500 whitespace-nowrap hover:underline"
    title="Numer rezerwacji"
  >
    {bookingNumber(b.id)}
  </Link>
</div>


                          <div className="text-sm text-gray-600">
                            {formatRange(b.startDate, b.endDate)}
                          </div>

                        <div className="text-sm text-gray-500">
                        Zgłoszona przez:{" "}
                          <span className="font-medium">
                        {b.renter?.name ?? "Usuario"}
                            </span>
                          </div>
                        </div>

                        {/* derecha */}
                        <div className="w-full sm:w-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end">
                          <div className="self-start sm:self-auto">
                            <StatusBadge status={b.status} />
                          </div>

                          <Link
                            href={`/bookings/${b.id}`}
                            className="w-full sm:w-auto px-3 py-2 rounded border text-gray-700 hover:bg-gray-50 text-center whitespace-nowrap"
                          >
                            Zobacz szczegóły
                          </Link>
                        </div>
                      </div>

                      {myExisting ? (
                        <div className="mt-3 text-sm text-gray-700">
                          Twoja ocena najemcy:{" "}
                          <strong>{myExisting.rating}/5</strong>
                        </div>
                      ) : iCanReview ? (
                        <form
                          action={createReviewAction}
                          className="mt-3 grid grid-cols-1 sm:grid-cols-6 gap-2"
                        >
                          <input type="hidden" name="bookingId" value={b.id} />
                          <input type="hidden" name="role" value="RENTER" />

                          <label className="sm:col-span-1">
                            <span className="text-xs text-gray-600">Ocena</span>
                            <select
                              name="rating"
                              required
                              className="border rounded p-2 w-full"
                              defaultValue=""
                            >
                              <option value="" disabled>
                                —
                              </option>
                              <option value="5">5</option>
                              <option value="4">4</option>
                              <option value="3">3</option>
                              <option value="2">2</option>
                              <option value="1">1</option>
                            </select>
                          </label>

                          <label className="sm:col-span-4">
                            <span className="text-xs text-gray-600">
                              Komentarz (opcjonalnie)
                            </span>
                            <input
                              name="comment"
                              placeholder="Jak oceniasz to doświadczenie?"
                              className="border rounded p-2 w-full"
                            />
                          </label>

                          <div className="sm:col-span-1 flex items-end">
                            <button className="w-full bg-emerald-600 text-white rounded px-3 py-2">
                              Oceń
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}
