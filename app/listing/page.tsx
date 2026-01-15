import Link from "next/link";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/admin/_lib/requireAdmin";

/* ===================== TYPES ===================== */
type DayPoint = { day: string; count: number };
type KV = { label: string; count: number };
type AdminSearchParams = { days?: string };

/* ===================== HELPERS ===================== */
function toInt(x: unknown): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function maxCount(points: DayPoint[]) {
  return points.reduce((m, p) => Math.max(m, p.count), 0) || 1;
}

/* ===================== COMPONENTS ===================== */
function Stat({
  title,
  value,
  sub,
}: {
  title: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border p-4 bg-white">
      <p className="text-sm text-gray-600">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function BarChart({ title, points }: { title: string; points: DayPoint[] }) {
  const max = maxCount(points);

  return (
    <div className="rounded-lg border p-4 bg-white">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-gray-500">Últimos {points.length} días</p>
      </div>

      <div className="flex items-end gap-1 h-28">
        {points.map((p) => (
          <div key={p.day} className="group relative flex-1">
            <div
              className="w-full rounded-sm bg-indigo-500/80"
              style={{ height: `${Math.round((p.count / max) * 100)}%` }}
              title={`${p.day}: ${p.count}`}
            />
            <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded bg-black px-2 py-1 text-xs text-white group-hover:block">
              {p.count}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-gray-500">
        <span>{points[0]?.day}</span>
        <span>{points.at(-1)?.day}</span>
      </div>
    </div>
  );
}

function SimpleTable({ title, rows }: { title: string; rows: KV[] }) {
  return (
    <div className="rounded-lg border p-4 bg-white">
      <p className="font-semibold mb-2">{title}</p>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr>
              <th className="py-2">Valor</th>
              <th className="py-2">Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t">
                <td className="py-2" colSpan={2}>
                  —
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.label} className="border-t">
                  <td className="py-2">{r.label || "—"}</td>
                  <td className="py-2">{r.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== PAGE ===================== */
export default async function AdminDashboard({
  searchParams,
}: {
  searchParams?: AdminSearchParams;
}) {
  await requireAdmin();

  const sp: AdminSearchParams =
    searchParams instanceof Promise
      ? (await searchParams) ?? {}
      : searchParams ?? {};

  const days = sp.days === "7" ? 7 : sp.days === "90" ? 90 : 30;

  /* ===================== KPIs ===================== */
  const [
    usersCount,
    listingsCount,
    bookingsCount,
    reviewsCount,
    bookingsPending,
    avgRatingAgg,
    sumAmountAgg,
    badReviewsCount,
    avgDurationRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count(),
    prisma.booking.count(),
    prisma.review.count(),
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.review.aggregate({ _avg: { rating: true } }),
    prisma.booking.aggregate({ _sum: { amountCents: true } }),
    prisma.review.count({ where: { rating: { lte: 2 } } }),
    prisma.$queryRaw<Array<{ avgDays: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM ("endDate" - "startDate")) / 86400.0) AS "avgDays"
      FROM "Booking";
    `,
  ]);

  const avgRating = avgRatingAgg._avg.rating ?? 0;
  const sumAmountCents = sumAmountAgg._sum.amountCents ?? 0;
  const avgDuration = avgDurationRaw[0]?.avgDays ?? 0;

  const conversion =
    listingsCount > 0
      ? ((bookingsCount / listingsCount) * 100).toFixed(1)
      : "0";

  /* ===================== SERIES ===================== */
  const [bookingsSeriesRaw, listingsSeriesRaw] = await Promise.all([
    prisma.$queryRaw<Array<{ day: string; count: number }>>`
      WITH dates AS (
        SELECT generate_series(
          (CURRENT_DATE - (${days} - 1) * INTERVAL '1 day')::date,
          CURRENT_DATE::date,
          INTERVAL '1 day'
        )::date AS day
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS day,
        COALESCE(b.count, 0)::int AS count
      FROM dates d
      LEFT JOIN (
        SELECT ("createdAt"::date) AS day, COUNT(*)::int AS count
        FROM "Booking"
        WHERE "createdAt" >= (CURRENT_DATE - (${days} - 1) * INTERVAL '1 day')
        GROUP BY ("createdAt"::date)
      ) b ON b.day = d.day
      ORDER BY d.day ASC;
    `,
    prisma.$queryRaw<Array<{ day: string; count: number }>>`
      WITH dates AS (
        SELECT generate_series(
          (CURRENT_DATE - (${days} - 1) * INTERVAL '1 day')::date,
          CURRENT_DATE::date,
          INTERVAL '1 day'
        )::date AS day
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS day,
        COALESCE(l.count, 0)::int AS count
      FROM dates d
      LEFT JOIN (
        SELECT ("createdAt"::date) AS day, COUNT(*)::int AS count
        FROM "Listing"
        WHERE "createdAt" >= (CURRENT_DATE - (${days} - 1) * INTERVAL '1 day')
        GROUP BY ("createdAt"::date)
      ) l ON l.day = d.day
      ORDER BY d.day ASC;
    `,
  ]);

  const bookingsSeries = bookingsSeriesRaw.map((r) => ({
    day: r.day,
    count: toInt(r.count),
  }));

  const listingsSeries = listingsSeriesRaw.map((r) => ({
    day: r.day,
    count: toInt(r.count),
  }));

  /* ===================== RENDER ===================== */
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[7, 30, 90].map((d) => (
          <Link
            key={d}
            href={`/admin?days=${d}`}
            className={`rounded-md border px-3 py-1 text-sm ${
              days === d ? "bg-indigo-600 text-white" : "hover:bg-gray-100"
            }`}
          >
            {d} días
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Usuarios" value={usersCount} />
        <Stat title="Anuncios" value={listingsCount} />
        <Stat title="Reservas" value={bookingsCount} sub={`Pendientes: ${bookingsPending}`} />
        <Stat title="Reviews" value={reviewsCount} sub={`Media: ${avgRating.toFixed(2)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart title="Reservas por día" points={bookingsSeries} />
        <BarChart title="Anuncios por día" points={listingsSeries} />
      </div>
    </div>
  );
}
