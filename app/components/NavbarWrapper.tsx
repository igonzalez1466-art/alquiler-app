import NavbarResponsive from "./NavbarResponsive";
import AuthLinks from "./AuthLinks";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";

type AppRole = "USER" | "ADMIN";

type SessionUser = {
  id?: string;
  role?: AppRole;
};

export default async function NavbarWrapper() {
  const session = (await getServerSession(authConfig)) as Session | null;

  const isLoggedIn = !!session?.user;
  const user = session?.user as unknown as SessionUser | undefined;

  const userId = user?.id;
  const userRole = user?.role;

  return (
    <NavbarResponsive
      isLoggedIn={isLoggedIn}
      userId={userId}
      userRole={userRole}
      auth={<AuthLinks />}
    />
  );
}
