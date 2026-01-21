// app/admin/_lib/requireAdmin.ts
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getSession } from "@/app/lib/auth";

export async function requireAdmin() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }

  if (session.user.role !== Role.ADMIN) {
    redirect("/"); // o "/account"
  }

  return session;
}
