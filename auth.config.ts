import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";

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

        // ✅ IMPORTANTE: devolvemos también role
        return {
          id: user.id,
          email: user.email!,
          name: user.name ?? undefined,
          image: (user as any).image ?? undefined,
          role: (user as any).role ?? "USER",
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // En el primer login, "user" viene de authorize()
      if (user) {
        token.sub = (user as any).id?.toString?.() ?? (user as any).id;
        token.email = (user as any).email;
        token.name = (user as any).name;
        token.picture = (user as any).image;

        // ✅ guardamos role en el JWT
        token.role = (user as any).role ?? "USER";
      }

      // (Opcional pero útil) si quieres mantenerlo siempre consistente,
      // podrías reconsultar DB aquí, pero no hace falta para empezar.

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string | undefined;
        session.user.image = token.picture as string | undefined;

        // ✅ exponemos role en session.user
        (session.user as any).role = (token as any).role ?? "USER";
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV !== "production",
} satisfies NextAuthConfig;
