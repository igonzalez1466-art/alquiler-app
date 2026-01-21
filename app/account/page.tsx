import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth";

export default async function AccountPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  const user = session.user;

  return (
    <div className="max-w-xl mx-auto mt-8 space-y-6">
      <h1 className="text-2xl font-bold">Mój profil</h1>

      <div className="rounded border p-4 space-y-2 bg-white">
        <p>
          <strong>Imię:</strong> {user.name ?? "—"}
        </p>
        <p>
          <strong>E-mail:</strong> {user.email ?? "—"}
        </p>
      </div>

      <div className="rounded border p-4 bg-gray-50 space-y-3">
        <h2 className="text-lg font-semibold">Zarządzanie</h2>
        <ul className="space-y-2">
          <li>
            <Link href="/listing?tab=my">🧾 Moje ogłoszenia</Link>
          </li>
          <li>
            <Link href="/listing/new">➕ Wystaw nowe ogłoszenie</Link>
          </li>
          <li>
            <Link href={`/users/${user.id}`}>⭐ Mój profil</Link>
          </li>
          <li>
            <Link href="/bookings">📅 Moje rezerwacje</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
