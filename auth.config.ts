import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";

type AppRole = "USER" | "ADMIN";

type AuthorizedUser = {
  id: string;
  email: string;
  name?: string;
  image?: string;
  role: AppRole;
};

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },

  providers: [
    Credentials({
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

        // ⛔️ bloquea si email no verificado
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        // Prisma ya tipa image y role si existen en el schema
        const out: AuthorizedUser = {
          id: String(user.id),
          email: user.email ?? "",
          name: user.name ?? undefined,
          image: user.image ?? undefined,
          role: user.role as AppRole,
        };

        return out;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // solo en el primer login
      if (user) {
        const u = user as AuthorizedUser;

        token.sub = u.id;
        token.email = u.email;
        token.name = u.name;
        token.picture = u.image;
        token.role = u.role;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role ?? "USER";
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV !== "production",
} satisfies NextAuthConfig;
