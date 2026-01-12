import Link from "next/link";
import { requireAdmin } from "./_lib/requireAdmin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  const links = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/users", label: "Usuarios" },
    { href: "/admin/listings", label: "Anuncios" },
    { href: "/admin/bookings", label: "Reservas" },
    { href: "/admin/reviews", label: "Reviews" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-gray-600">Panel de administración</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-lg border bg-white p-3">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-3 py-2 text-sm hover:bg-gray-100"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="rounded-lg border bg-white p-4">
          {children}
        </section>
      </div>
    </div>
  );
}
