import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "../_lib/requireAdmin";

export default async function AdminUsersPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    take: 200,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
    },
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-3">Usuarios</h2>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr>
              <th className="py-2">Email</th>
              <th className="py-2">Nombre</th>
              <th className="py-2">Role</th>
              <th className="py-2">Verificado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="py-2">{u.email ?? "-"}</td>
                <td className="py-2">{u.name ?? "-"}</td>
                <td className="py-2">{u.role}</td>
                <td className="py-2">{u.emailVerified ? "Sí" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
