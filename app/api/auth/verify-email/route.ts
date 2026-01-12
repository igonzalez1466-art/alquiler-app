import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email = "", code = "" } = await req.json();

    const e = email.toLowerCase().trim();
    if (!e || !code) {
      return NextResponse.json(
        { error: "E-mail i kod są obowiązkowe" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email: e } });

    if (!user) {
      return NextResponse.json(
        { error: "Użytkownik nie istnieje" },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "E-mail jest już zweryfikowany" },
        { status: 400 }
      );
    }

    if (!user.verificationCode || !user.verificationExpiresAt) {
      return NextResponse.json(
        { error: "Brak aktywnego kodu weryfikacyjnego" },
        { status: 400 }
      );
    }

    if (user.verificationExpiresAt < new Date()) {
      return NextResponse.json(
        {
          error:
            "Kod wygasł, zarejestruj się ponownie lub poproś o nowy kod weryfikacyjny",
        },
        { status: 400 }
      );
    }

    const ok = await bcrypt.compare(code, user.verificationCode);
    if (!ok) {
      return NextResponse.json(
        { error: "Nieprawidłowy kod" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationExpiresAt: null,
      },
    });

    return NextResponse.json(
      { ok: true, message: "E-mail został poprawnie zweryfikowany" },
      { status: 200 }
    );
  } catch (err) {
    console.error("VERIFY ERROR:", err);
    return NextResponse.json(
      { error: "Błąd podczas weryfikacji" },
      { status: 500 }
    );
  }
}
