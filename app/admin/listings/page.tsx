import Link from "next/link";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "../_lib/requireAdmin";
import { adminToggleListingAvailable } from "./actions";

export default async function AdminListingsPage() {
  await requireAdmin();

  const listings = await prisma.listing.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      city: true,
      createdAt: true,
      available: true,
      user: { select: { email: true, name: true } },
    },
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-3">Anuncios</h2>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr>
              <th className="py-2">Título</th>
              <th className="py-2">Ciudad</th>
              <th className="py-2">Dueño</th>
              <th className="py-2">Creado</th>
              <th className="py-2">Abrir</th>
              <th className="py-2 text-right">Activo</th>
            </tr>
          </thead>

          <tbody>
            {listings.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="py-2">{l.title}</td>
                <td className="py-2">{l.city ?? "-"}</td>
                <td className="py-2">
                  {l.user?.email ?? l.user?.name ?? "-"}
                </td>
                <td className="py-2">
                  {new Date(l.createdAt).toLocaleString("es-ES")}
                </td>

                <td className="py-2">
                  <Link
                    href={`/listing/${l.id}`}
                    className="text-indigo-600 hover:underline"
                  >
                    Abrir
                  </Link>
                </td>

                <td className="py-2 text-right">
                  <form action={adminToggleListingAvailable} className="inline">
                    <input type="hidden" name="listingId" value={l.id} />
                    <input
                      type="hidden"
                      name="next"
                      value={String(!l.available)}
                    />
                    <button
                      type="submit"
                      className={`rounded-md px-3 py-1 text-xs font-medium border transition ${
                        l.available
                          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                      }`}
                      title={l.available ? "Desactivar" : "Activar"}
                    >
                      {l.available ? "Activo" : "Desactivado"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}

            {listings.length === 0 && (
              <tr className="border-t">
                <td className="py-3" colSpan={6}>
                  No hay anuncios todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
