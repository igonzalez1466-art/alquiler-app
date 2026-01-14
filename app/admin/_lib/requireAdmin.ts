import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { redirect } from "next/navigation";

type AppRole = "USER" | "ADMIN";

export async function requireAdmin() {
  const session = await getServerSession(authConfig);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  // tipamos session.user de forma segura
  const user = session.user as unknown as {
    id?: string;
    role?: AppRole;
  };

  if (user.role !== "ADMIN") {
    redirect("/");
  }

  return session;
}
