// app/components/AuthLinks.tsx  (Server Component)
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";

export default async function AuthLinks() {
  const session = (await getServerSession(authConfig)) as Session | null;

  if (session?.user) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm">
          {session.user.name ?? session.user.email}
        </span>

        <Link href="/account" className="underline">
          Moje konto
        </Link>

        {/* NextAuth v4: logout por endpoint */}
        <form action="/api/auth/signout" method="post">
          <button type="submit" className="underline">
            Wyloguj się
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link href="/login" className="underline">
        Zaloguj się
      </Link>
      <Link href="/register" className="underline">
        Rejestracja
      </Link>
    </div>
  );
}
