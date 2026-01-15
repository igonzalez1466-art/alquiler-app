// app/next-auth.d.ts  (o /types/next-auth.d.ts)

import type { DefaultSession } from "next-auth";

type AppRole = "USER" | "ADMIN";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
  }
}
