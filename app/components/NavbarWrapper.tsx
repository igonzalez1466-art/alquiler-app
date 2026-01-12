// app/components/NavbarWrapper.tsx
import NavbarResponsive from "./NavbarResponsive";
import AuthLinks from "./AuthLinks";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export default async function NavbarWrapper() {
  const session = await getServerSession(authConfig);

  const isLoggedIn = !!session?.user;

  // En tu session callback estabas guardando id y role como "any"
  const userId = (session?.user as any)?.id as string | undefined;
  const userRole = (session?.user as any)?.role as string | undefined;

  return (
    <NavbarResponsive
      isLoggedIn={isLoggedIn}
      userId={userId}
      userRole={userRole}                 // ✅ nuevo
      auth={<AuthLinks session={session} />}
    />
  );
}
