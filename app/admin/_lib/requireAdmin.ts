import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const session = await getServerSession(authConfig);
  const role = (session?.user as any)?.role;

  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (role !== "ADMIN") redirect("/");

  return session;
}
