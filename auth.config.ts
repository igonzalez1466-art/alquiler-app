// auth.config.ts
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

type AuthorizedUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: Role;
};

type JWTWithRole = JWT & { role?: Role };

export const authConfig: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,

  // 👇 importante: literal "jwt" (con NextAuthOptions tipado ya no se convierte en string)
  session: { strategy: "jwt" },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email || "").toLowerCase().trim();
        const password = String(creds?.password || "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        if (!user.emailVerified) throw new Error("EMAIL_NOT_VERIFIED");

        const out: AuthorizedUser = {
          id: user.id,
          email: user.email ?? "",
          name: user.name ?? null,
          image: user.image ?? null,
          role: user.role,
        };

        return out;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // id
        if (typeof user.id === "string") token.sub = user.id;

        // role (solo seguro en tu AuthorizedUser)
        const role = (user as Partial<AuthorizedUser>).role;
        if (role) (token as JWTWithRole).role = role;
      }
      return token;
    },

    async session({ session, token }) {
      const t = token as JWTWithRole;

      if (session.user) {
        session.user.id = typeof t.sub === "string" ? t.sub : "";
        session.user.role = t.role ?? Role.USER;
      }

      return session;
    },
  },

  debug: process.env.NODE_ENV !== "production",
};
