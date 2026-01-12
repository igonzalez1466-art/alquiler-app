import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "../_lib/requireAdmin";

export default async function AdminBookingsPage() {
  await requireAdmin();

  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      listing: { select: { id: true, title: true } },
      renter: { select: { id: true, email: true, name: true } },
    },
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-3">Reservas</h2>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr>
              <th className="py-2">Fecha</th>
              <th className="py-2">Estado</th>
              <th className="py-2">Renter</th>
              <th className="py-2">Anuncio</th>
              <th className="py-2">Rango</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="py-2">
                  {new Date(b.createdAt).toLocaleString()}
                </td>
                <td className="py-2">{b.status}</td>
                <td className="py-2">
                  {b.renter?.email ?? b.renter?.name ?? "-"}
                </td>
                <td className="py-2">{b.listing?.title ?? "-"}</td>
                <td className="py-2">
                  {new Date(b.startDate).toLocaleDateString()} →{" "}
                  {new Date(b.endDate).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
