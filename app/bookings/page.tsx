// app/bookings/page.tsx
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/auth";
import Link from "next/link";
import type { Prisma } from "@prisma/client";

/* ============ Helpers ============ */
function formatRange(a: Date, b: Date) {
  const f = (d: Date) =>
    d.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  return `${f(a)} — ${f(b)}`;
}

function cx(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

const statusLabel: Record<BookingStatus, string> = {
  PENDING: "Oczekująca",
  CONFIRMED: "Potwierdzona",
  CANCELLED: "Odrzucona",
};

const statusClass: Record<BookingStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
};

// ✅ plural PL dla "rezerwacja"
function pluralPLBooking(n: number) {
  if (n === 1) return "rezerwacja";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return "rezerwacje";
  }
  return "rezerwacji";
}

function StatusBadge({ status }: { status: string }) {
  const key = status as BookingStatus;

  const cls =
    key in statusClass
      ? statusClass[key]
      : "bg-gray-100 text-gray-800 border-gray-200";

  const label = key in statusLabel ? statusLabel[key] : status;

  return (
    <span className={cx("text-xs px-2 py-1 rounded border", cls)}>{label}</span>
  );
}

type SP = {
  mStatus?: "all" | BookingStatus;
  mFrom?: string;
  mTo?: string;
  mSort?: "start_desc" | "start_asc" | "created_desc" | "created_asc";

  oStatus?: "all" | BookingStatus;
  oFrom?: string;
  oTo?: string;
  oSort?: "start_desc" | "start_asc" | "created_desc" | "created_asc";
};

const parseDay = (s?: string) => {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const endOfDay = (d: Date) => {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
};

/* ============ Server Action: crear review ============ */
async function createReviewAction(formData: FormData) {
  "use server";

  const session = await getSession();
  if (!session?.user?.id) throw new Error("Brak autoryzacji");

  const reviewerId = session.user.id;
  const bookingId = String(formData.get("bookingId") || "");
  const role = String(formData.get("role") || ""); // "OWNER" | "RENTER"
  const rating = Number(formData.get("rating") || "0");
  const comment = String(formData.get("comment") || "").trim();

  if (!bookingId || !["OWNER", "RENTER"].includes(role)) {
    throw new Error("Nieprawidłowe dane");
  }
  if (!(rating >= 1 && rating <= 5)) throw new Error("Ocena poza zakresem");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { listing: { select: { userId: true } } },
  });
  if (!booking) throw new Error("Nie znaleziono rezerwacji");

  const now = new Date();
  const isParticipant =
    booking.renterId === reviewerId || booking.listing.userId === reviewerId;

  if (!isParticipant) throw new Error("Brak uprawnień");
  if (booking.status !== "CONFIRMED" || booking.endDate > now) {
    throw new Error("Można oceniać tylko potwierdzone i zakończone rezerwacje");
  }

  let revieweeId: string;
  if (role === "OWNER") {
    // Najemca ocenia właściciela
    if (booking.renterId !== reviewerId)
      throw new Error("Nieprawidłowa rola dla tej rezerwacji");
    revieweeId = booking.listing.userId;
  } else {
    // Właściciel ocenia najemcę
    if (booking.listing.userId !== reviewerId)
      throw new Error("Nieprawidłowa rola dla tej rezerwacji");
    revieweeId = booking.renterId;
  }

  const existing = await prisma.review.findFirst({
    where: { bookingId, reviewerId, revieweeId },
    select: { id: true },
  });
  if (existing) throw new Error("Ocena dla tej rezerwacji już istnieje");

  await prisma.review.create({
    data: {
      bookingId,
      reviewerId,
      revieweeId,
      role: role as "OWNER" | "RENTER",
      rating,
      comment: comment || null,
    },
  });
}

/* ============ PAGE ============ */
export default async function BookingsPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const p: SP = (await searchParams) ?? {};

  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-red-600 mb-2">
          Musisz się zalogować, aby zobaczyć swoje rezerwacje.
        </p>
        <Link href="/login" className="text-blue-600 underline">
          Zaloguj się
        </Link>
      </div>
    );
  }

  /* ====== Filtros "Moje rezerwacje" ====== */
  const mStatus = p.mStatus ?? "all";
  const mFrom = parseDay(p.mFrom);
  const mTo = parseDay(p.mTo) ? endOfDay(parseDay(p.mTo)!) : undefined;
  const mSort = p.mSort ?? "start_desc";

  const madeWhere: Prisma.BookingWhereInput = { renterId: userId };
  if (mStatus !== "all") madeWhere.status = mStatus;
  if (mFrom || mTo) {
    madeWhere.startDate = { gte: mFrom, lte: mTo };
  }

  let madeOrderBy: Prisma.BookingOrderByWithRelationInput = { startDate: "desc" };
  if (mSort === "start_asc") madeOrderBy = { startDate: "asc" };
  if (mSort === "created_desc") madeOrderBy = { createdAt: "desc" };
  if (mSort === "created_asc") madeOrderBy = { createdAt: "asc" };

  /* ====== Filtros "Rezerwacje w moich ogłoszeniach" ====== */
  const oStatus = p.oStatus ?? "all";
  const oFrom = parseDay(p.oFrom);
  const oTo = parseDay(p.oTo) ? endOfDay(parseDay(p.oTo)!) : undefined;
  const oSort = p.oSort ?? "start_desc";

  const ownerWhere: Prisma.BookingWhereInput = { listing: { userId } };
  if (oStatus !== "all") ownerWhere.status = oStatus;
  if (oFrom || oTo) {
    ownerWhere.startDate = { gte: oFrom, lte: oTo };
  }

  let ownerOrderBy: Prisma.BookingOrderByWithRelationInput = { startDate: "desc" };
  if (oSort === "start_asc") ownerOrderBy = { startDate: "asc" };
  if (oSort === "created_desc") ownerOrderBy = { createdAt: "desc" };
  if (oSort === "created_asc") ownerOrderBy = { createdAt: "asc" };

  /* ====== Queries ====== */
  const [asRenter, asOwner] = await Promise.all([
 prisma.booking.findMany({
  where: madeWhere,
  select: {
    id: true,
    bookingNumber: true,
    listingId: true,
    renterId: true,
    startDate: true,
    endDate: true,
    status: true,
    createdAt: true,
    listing: {
      select: {
        id: true,
        title: true,
        userId: true,
        pricePerDay: true,
        fianza: true,
      },
    },
    renter: { select: { id: true, name: true, email: true } },
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
        listing: {
          select: {
            id: true,
            title: true,
            userId: true,
            pricePerDay: true, // ✅
            fianza: true, // ✅
          },
        },
        renter: { select: { id: true, name: true, email: true } },
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

  // ====== Reputación (reviews recibidas como NAJEMCA) para los renters de asOwner ======
  const renterIds = Array.from(
    new Set(asOwner.map((b) => b.renter?.id).filter(Boolean) as string[])
  );

  const renterAgg = renterIds.length
    ? await prisma.review.groupBy({
        by: ["revieweeId"],
        where: {
          revieweeId: { in: renterIds },
          role: "RENTER",
        },
        _avg: { rating: true },
        _count: { rating: true },
      })
    : [];

  const renterStats = new Map(
    renterAgg.map((r) => [
      r.revieweeId,
      { avg: r._avg.rating ?? null, count: r._count.rating },
    ])
  );

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

      {/* ===================== JAKO NAJEMCA ===================== */}
      <section>
        <details className="space-y-3" open>
          <summary className="flex items-center justify-between cursor-pointer list-none border-b pb-2 mb-2 [&::-webkit-details-marker]:hidden">
            <span className="text-xl font-semibold">Moje rezerwacje</span>
            <span className="text-sm text-gray-500">
              {asRenter.length} {pluralPLBooking(asRenter.length)}
            </span>
          </summary>

          <div className="space-y-3">
            <form
              method="GET"
              className="rounded border p-3 grid grid-cols-2 md:grid-cols-6 gap-2 bg-white"
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

              {/* zachowaj filtry właściciela */}
              <input type="hidden" name="oStatus" value={p.oStatus ?? "all"} />
              <input type="hidden" name="oFrom" value={p.oFrom ?? ""} />
              <input type="hidden" name="oTo" value={p.oTo ?? ""} />
              <input type="hidden" name="oSort" value={p.oSort ?? "start_desc"} />

              <div className="col-span-2 md:col-span-1 flex gap-2">
                <button className="flex-1 bg-indigo-600 text-white rounded px-3 py-2">
                  Zastosuj
                </button>
                <Link
                  href="/bookings"
                  className="flex-1 text-center border rounded px-3 py-2"
                >
                  Wyczyść filtry
                </Link>
              </div>
            </form>

            {asRenter.length === 0 ? (
              <p className="text-gray-500">Brak rezerwacji dla wybranych filtrów.</p>
            ) : (
              <ul className="space-y-3">
                {asRenter.map((b) => {
                  const iCanReview =
                    b.status === "CONFIRMED" &&
                    b.endDate < now &&
                    !b.reviews.some(
                      (r) => r.reviewerId === userId && r.role === "OWNER"
                    );

                  return (
                    <li key={b.id} className="p-4 border rounded bg-white shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                        <div className="flex items-center gap-2">
  <Link
    href={`/listing/${b.listingId}`}
    className="text-blue-700 hover:underline font-medium"
  >
    {b.listing?.title ?? "Ogłoszenie"}
  </Link>

  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border">
    #{b.bookingNumber}
  </span>
</div>


                          <div className="text-sm text-gray-600 mt-1">
                            {formatRange(b.startDate, b.endDate)}
                          </div>

                          {/* ✅ CENA + KAUCJA */}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-700">
                            <span className="rounded border bg-gray-50 px-2 py-1">
                              Cena:{" "}
                              <span className="font-semibold">
                                {b.listing.pricePerDay} zł / dzień
                              </span>
                            </span>

                            <span className="rounded border bg-gray-50 px-2 py-1">
                              Kaucja:{" "}
                              <span className="font-semibold">
                                {b.listing.fianza != null
                                  ? `${b.listing.fianza} zł`
                                  : "Brak"}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <StatusBadge status={b.status} />
                          <Link
                            href={`/bookings/${b.id}`}
                            className="px-3 py-1 rounded border text-gray-700 hover:bg-gray-50"
                          >
                            Zobacz szczegóły
                          </Link>
                        </div>
                      </div>

                      {iCanReview ? (
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

      {/* ===================== JAKO WŁAŚCICIEL ===================== */}
      <section>
        <details className="space-y-3">
          <summary className="flex items-center justify-between cursor-pointer list-none border-b pb-2 mb-2 [&::-webkit-details-marker]:hidden">
            <span className="text-xl font-semibold">
              Rezerwacje otrzymane
            </span>
            <span className="text-sm text-gray-500">
              {asOwner.length} {pluralPLBooking(asOwner.length)}
            </span>
          </summary>

          <div className="space-y-3">
            <form
              method="GET"
              className="rounded border p-3 grid grid-cols-2 md:grid-cols-6 gap-2 bg-white"
            >
              {/* zachowaj filtry najemcy */}
              <input type="hidden" name="mStatus" value={p.mStatus ?? "all"} />
              <input type="hidden" name="mFrom" value={p.mFrom ?? ""} />
              <input type="hidden" name="mTo" value={p.mTo ?? ""} />
              <input type="hidden" name="mSort" value={p.mSort ?? "start_desc"} />

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

              <div className="col-span-2 md:col-span-1 flex gap-2">
                <button className="flex-1 bg-indigo-600 text-white rounded px-3 py-2">
                  Zastosuj
                </button>
                <Link
                  href={`/bookings?${preserveM}`}
                  className="flex-1 text-center border rounded px-3 py-2"
                >
                  Wyczyść filtry
                </Link>
              </div>
            </form>

            {asOwner.length === 0 ? (
              <p className="text-gray-500">Brak rezerwacji dla wybranych filtrów.</p>
            ) : (
              <ul className="space-y-3">
                {asOwner.map((b) => {
                  const iCanReview =
                    b.status === "CONFIRMED" &&
                    b.endDate < now &&
                    !b.reviews.some(
                      (r) => r.reviewerId === userId && r.role === "RENTER"
                    );

                  const rs = b.renter?.id ? renterStats.get(b.renter.id) : undefined;

                  return (
                    <li key={b.id} className="p-4 border rounded bg-white shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                         <div className="flex items-center gap-2">
  <Link
    href={`/listing/${b.listingId}`}
    className="text-blue-700 hover:underline font-medium"
  >
    {b.listing?.title ?? "Ogłoszenie"}
  </Link>

  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border">
    #{b.bookingNumber}
  </span>
</div>


                          <div className="text-sm text-gray-600">
                            {formatRange(b.startDate, b.endDate)}
                          </div>

                          {/* ✅ CENA + KAUCJA */}
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-700">
                            <span className="rounded border bg-gray-50 px-2 py-1">
                              Cena:{" "}
                              <span className="font-semibold">
                                {b.listing.pricePerDay} zł / dzień
                              </span>
                            </span>

                            <span className="rounded border bg-gray-50 px-2 py-1">
                              Kaucja:{" "}
                              <span className="font-semibold">
                                {b.listing.fianza != null
                                  ? `${b.listing.fianza} zł`
                                  : "Brak"}
                              </span>
                            </span>
                          </div>

                          <div className="text-sm text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>Rezerwacja od:</span>

                            {b.renter?.id ? (
                              <Link
                                href={`/users/${b.renter.id}`}
                                className="font-medium text-blue-700 hover:underline"
                              >
                                {b.renter?.name ?? "Użytkownik"}
                              </Link>
                            ) : (
                              <span className="font-medium">
                                {b.renter?.name ?? "Użytkownik"}
                              </span>
                            )}

                            {rs?.count ? (
                              <span className="text-xs text-gray-600">
                                ★ {rs.avg?.toFixed(1)} ({rs.count})
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Brak ocen</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <StatusBadge status={b.status} />
                          <Link
                            href={`/bookings/${b.id}`}
                            className="px-3 py-1 rounded border text-gray-700 hover:bg-gray-50"
                          >
                            Zobacz szczegóły
                          </Link>
                        </div>
                      </div>

                      {iCanReview ? (
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
