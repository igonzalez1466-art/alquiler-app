import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ message: "Link do resetowania i nowe hasło są wymagane." }, { status: 400 });
    }

    // Busca el token
    const vt = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!vt) {
      return NextResponse.json({ message: "Link do resetowania hasła jest nieprawidłowy." }, { status: 400 });
    }

    if (vt.expires < new Date()) {
      // Limpia el token caducado
      await prisma.verificationToken.delete({ where: { token } });
      return NextResponse.json({ message: "Link do resetowania hasła wygasł. Poproś o nowy link." }, { status: 400 });
    }

    // vt.identifier = email al que mandaste el enlace
    const user = await prisma.user.findUnique({
      where: { email: vt.identifier },
    });

    if (!user) {
      // Limpia el token por seguridad
      await prisma.verificationToken.delete({ where: { token } });
      return NextResponse.json({ message: "Nie znaleziono użytkownika." }, { status: 400 });
    }

    // Actualiza contraseña
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash },
    });

    // Borra el token usado
    await prisma.verificationToken.delete({ where: { token } });

    return NextResponse.json({ message: "Hasło zostało zresetowane." });
  } catch (e) {
    console.error("RESET → error:", e);
    return NextResponse.json({ message: "Wystąpił błąd. Spróbuj ponownie później." }, { status: 500 });
  }
}
