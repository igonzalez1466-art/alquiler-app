// app/account/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authConfig } from "@/auth.config";

export default async function AccountPage() {
  const session = await getServerSession(authConfig as any);

  // 🔒 Si no hay sesión → redirige a login
  if (!session) redirect("/login?callbackUrl=/account");

  const user = session.user;

  return (
    <div className="max-w-xl mx-auto mt-8 space-y-6">
      <h1 className="text-2xl font-bold">Mój profil</h1>

      {/* Datos del usuario */}
      <div className="rounded border p-4 space-y-2 bg-white">
        <p>
          <strong>Imię:</strong> {user?.name ?? "—"}
        </p>
        <p>
          <strong>E-mail:</strong> {user?.email ?? "—"}
        </p>
      </div>

      {/* Sección de accesos rápidos */}
      <div className="rounded border p-4 bg-gray-50 space-y-3">
        <h2 className="text-lg font-semibold">Zarządzanie</h2>
        <ul className="space-y-2">
          <li>
            <Link
              href="/listing?tab=my"
              className="block rounded border border-gray-200 bg-white px-3 py-2 hover:bg-gray-100 transition"
            >
              🧾 Moje ogłoszenia
            </Link>
          </li>
          <li>
            <Link
              href="/listing/new"
              className="block rounded border border-gray-200 bg-white px-3 py-2 hover:bg-gray-100 transition"
            >
              ➕ Wystaw nowe ogłoszenie
            </Link>
          </li>
          <li>
            <Link
              href={`/users/${user?.id}`} // ⭐ Perfil con medias (como propietario e inquilino)
              className="block rounded border border-gray-200 bg-white px-3 py-2 hover:bg-gray-100 transition"
            >
              ⭐ Mój profil (oceny)
            </Link>
          </li>
          <li>
            <Link
              href="/bookings"
              className="block rounded border border-gray-200 bg-white px-3 py-2 hover:bg-gray-100 transition"
            >
              📅 Moje rezerwacje
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
