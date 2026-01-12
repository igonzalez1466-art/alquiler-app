import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ message: "Token y contraseña son requeridos" }, { status: 400 });
    }

    // Busca el token
    const vt = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!vt) {
      return NextResponse.json({ message: "Token inválido" }, { status: 400 });
    }

    if (vt.expires < new Date()) {
      // Limpia el token caducado
      await prisma.verificationToken.delete({ where: { token } });
      return NextResponse.json({ message: "Token caducado" }, { status: 400 });
    }

    // vt.identifier = email al que mandaste el enlace
    const user = await prisma.user.findUnique({
      where: { email: vt.identifier },
    });

    if (!user) {
      // Limpia el token por seguridad
      await prisma.verificationToken.delete({ where: { token } });
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 400 });
    }

    // Actualiza contraseña
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash },
    });

    // Borra el token usado
    await prisma.verificationToken.delete({ where: { token } });

    return NextResponse.json({ message: "Password has been reset" });
  } catch (e) {
    console.error("RESET → error:", e);
    return NextResponse.json({ message: "Error interno" }, { status: 500 });
  }
}
