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

type TokenWithRole = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  role?: AppRole;
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

        // ⛔️ Bloquea si el e-mail NO está verificado
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        // ✅ devolvemos datos extra
        // Nota: si tu modelo Prisma tiene image/role, TS ya te lo dejará usar.
        // Si no los tiene tipados (por schema viejo), hacemos lectura segura:
        const image =
          typeof (user as unknown as { image?: unknown }).image === "string"
            ? (user as unknown as { image: string }).image
            : undefined;

        const roleRaw = (user as unknown as { role?: unknown }).role;
        const role: AppRole =
          roleRaw === "ADMIN" || roleRaw === "USER" ? roleRaw : "USER";

        const out: AuthorizedUser = {
          id: String(user.id),
          email: user.email ?? "",
          name: user.name ?? undefined,
          image,
          role,
        };

        return out;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // En el primer login, "user" viene de authorize()
      if (user) {
        const u = user as unknown as Partial<AuthorizedUser>;

        if (typeof u.id === "string") token.sub = u.id;
        if (typeof u.email === "string") token.email = u.email;
        if (typeof u.name === "string") token.name = u.name;
        if (typeof u.image === "string") token.picture = u.image;

        // ✅ guardamos role en el JWT
        const role: AppRole =
          u.role === "ADMIN" || u.role === "USER" ? u.role : "USER";
        (token as unknown as TokenWithRole).role = role;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        // añadimos id y role a session.user sin any
        const su = session.user as unknown as {
          id?: string;
          role?: AppRole;
          email?: string;
          name?: string;
          image?: string;
        };

        if (typeof token.sub === "string") su.id = token.sub;
        if (typeof token.email === "string") session.user.email = token.email;
        session.user.name =
          typeof token.name === "string" ? token.name : undefined;
        session.user.image =
          typeof token.picture === "string" ? token.picture : undefined;

        const t = token as unknown as TokenWithRole;
        su.role = t.role ?? "USER";
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV !== "production",
} satisfies NextAuthConfig;
