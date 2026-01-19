import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import Link from "next/link";

/* ============ Utils ============ */
function bookingNumber(id: string) {
  return `BK-${id.slice(0, 8)}`;
}

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

/* ============ Status ============ */
const statusLabel = {
  PENDING: "Oczekująca",
  CONFIRMED: "Potwierdzona",
  CANCELLED: "Odrzucona",
} as const;

const statusClass = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
} as const;

function StatusBadge({ status }: { status: string }) {
  const cls =
    status in statusClass
      ? statusClass[status as keyof typeof statusClass]
      : "bg-gray-100 text-gray-800 border-gray-200";

  const label =
    status in statusLabel
      ? statusLabel[status as keyof typeof statusLabel]
      : status;

  return <span className={cx("text-xs px-2 py-1 rounded border", cls)}>{label}</span>;
}

/* ============ Search Params ============ */
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

/* ============ Server Action ============ */
async function createReviewAction(formData: FormData) {
  "use server";

  const session = await getServerSession(authConfig);
  if (!session?.user?.id) throw new Error("No autorizado");

  const reviewerId = session.user.id;
  const bookingId = String(formData.get("bookingId") || "");
  const role = String(formData.get("role") || "");
  const rating = Number(formData.get("rating") || "0");
  const comment = String(formData.get("comment") || "").trim();

  if (!bookingId || !["OWNER", "RENTER"].includes(role)) {
    throw new Error("Datos inválidos");
  }
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

  const revieweeId = role === "OWNER" ? booking.listing.userId : booking.renterId;

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
  // ✅ Next 15: en tu proyecto el tipo generado exige Promise
  searchParams?: Promise<SP>;
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

  /* ===== RENTER FILTERS ===== */
  const mStatus = p.mStatus ?? "all";
  const mFrom = parseDay(p.mFrom);
  const mTo = parseDay(p.mTo) ? endOfDay(parseDay(p.mTo)!) : undefined;
  const mSort = p.mSort ?? "start_desc";

  const madeWhere: Record<string, unknown> = { renterId: userId };
  if (mStatus !== "all") madeWhere.status = mStatus;
  if (mFrom || mTo) madeWhere.startDate = { gte: mFrom, lte: mTo };

  let madeOrderBy: Record<string, "asc" | "desc"> = { startDate: "desc" };
  if (mSort === "start_asc") madeOrderBy = { startDate: "asc" };
  if (mSort === "created_desc") madeOrderBy = { createdAt: "desc" };
  if (mSort === "created_asc") madeOrderBy = { createdAt: "asc" };

  /* ===== OWNER FILTERS ===== */
  const oStatus = p.oStatus ?? "all";
  const oFrom = parseDay(p.oFrom);
  const oTo = parseDay(p.oTo) ? endOfDay(parseDay(p.oTo)!) : undefined;
  const oSort = p.oSort ?? "start_desc";

  const ownerWhere: Record<string, unknown> = { listing: { userId } };
  if (oStatus !== "all") ownerWhere.status = oStatus;
  if (oFrom || oTo) ownerWhere.startDate = { gte: oFrom, lte: oTo };

  let ownerOrderBy: Record<string, "asc" | "desc"> = { startDate: "desc" };
  if (oSort === "start_asc") ownerOrderBy = { startDate: "asc" };
  if (oSort === "created_desc") ownerOrderBy = { createdAt: "desc" };
  if (oSort === "created_asc") ownerOrderBy = { createdAt: "asc" };

  const [asRenter, asOwner] = await Promise.all([
    prisma.booking.findMany({
      where: madeWhere as never,
      orderBy: madeOrderBy as never,
      include: {
        listing: { select: { id: true, title: true, userId: true } },
        reviews: true,
      },
    }),
    prisma.booking.findMany({
      where: ownerWhere as never,
      orderBy: ownerOrderBy as never,
      include: {
        listing: { select: { id: true, title: true, userId: true } },
        renter: { select: { id: true, name: true } },
        reviews: true,
      },
    }),
  ]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-10">
      <h1 className="text-2xl font-bold">Rezerwacje</h1>
      {/* … resto del JSX igual que antes … */}
    </div>
  );
}
