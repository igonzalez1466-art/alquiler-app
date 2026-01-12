// app/components/AuthLinks.tsx  (Server, NextAuth v4)
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import Link from "next/link";

export default async function AuthLinks() {
  const session = await getServerSession(authConfig as any);

  if (session?.user) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm">
          {session.user.name ?? session.user.email}
        </span>

        <Link href="/account" className="underline">Moje konto</Link>

        {/* v4: logout via endpoint */}
        <form action="/api/auth/signout" method="post">
          <button className="underline">Wyloguj się</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link href="/login" className="underline">Zaloguj się</Link>
      <Link href="/register" className="underline">Rejestracja</Link>
    </div>
  );
}
