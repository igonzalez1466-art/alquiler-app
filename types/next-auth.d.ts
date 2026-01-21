import "next-auth";
import "next-auth/jwt";
import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id: string;
      role?: Role; // ✅ opcional para no romper AdapterUser
    };
  }

  interface User {
    id: string;
    role?: Role; // ✅ opcional
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
  }
}

export {};
