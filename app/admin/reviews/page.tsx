import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "../_lib/requireAdmin";

export default async function AdminReviewsPage() {
  await requireAdmin();

  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      reviewer: { select: { email: true, name: true } },
      reviewee: { select: { email: true, name: true } },
      booking: { select: { id: true } },
    },
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-3">Reviews</h2>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr>
              <th className="py-2">Fecha</th>
              <th className="py-2">Rating</th>
              <th className="py-2">Rol</th>
              <th className="py-2">Autor</th>
              <th className="py-2">Destinatario</th>
              <th className="py-2">Comentario</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="py-2">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="py-2">{r.rating}</td>
                <td className="py-2">{r.role}</td>
                <td className="py-2">{r.reviewer?.email ?? r.reviewer?.name ?? "-"}</td>
                <td className="py-2">{r.reviewee?.email ?? r.reviewee?.name ?? "-"}</td>
                <td className="py-2">{r.comment ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
