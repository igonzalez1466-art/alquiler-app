import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
}

// ✅ Password robusta
function isStrongPassword(pw: string) {
  return (
    pw.length >= 8 &&
    /[a-z]/.test(pw) &&
    /[A-Z]/.test(pw) &&
    /\d/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw)
  );
}

export async function POST(req: Request) {
  try {
    const { name = "", email = "", password = "" } = await req.json();

    const e = String(email).toLowerCase().trim();
    const pw = String(password);

    if (!e || !pw) {
      return NextResponse.json(
        { error: "E-mail i hasło są obowiązkowe" },
        { status: 400 }
      );
    }

    // ✅ Contraseña robusta
    if (!isStrongPassword(pw)) {
      return NextResponse.json(
        {
          error:
            "Hasło musi mieć co najmniej 8 znaków oraz zawierać wielką literę, małą literę, cyfrę i znak specjalny.",
        },
        { status: 400 }
      );
    }

    const exists = await prisma.user.findUnique({ where: { email: e } });
    if (exists) {
      return NextResponse.json(
        { error: "Ten adres e-mail jest już używany" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(pw, 10);

    // generar código
    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: e,
        passwordHash,
        emailVerified: false,
        verificationCode: codeHash,
        verificationExpiresAt: expiresAt,
      },
      select: { id: true, name: true, email: true },
    });

    // ✅ FIX TypeScript: email puede venir como string | null
    if (!user.email) {
      return NextResponse.json(
        { error: "Usuario sin email (datos inválidos en DB)" },
        { status: 500 }
      );
    }

    console.log("✅ Usuario creado, enviando email a:", user.email);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const verifyUrl = `${baseUrl}/verify-email?email=${encodeURIComponent(
      user.email
    )}&code=${encodeURIComponent(code)}`;

    const smtpPort = Number(process.env.SMTP_PORT) || 587;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465, // ✅ 465 => true, otros => false
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: "Potwierdź swój adres e-mail",
      html: `
        <p>Cześć ${user.name || ""}!</p>

        <p>Twój kod weryfikacyjny to:</p>
        <p style="font-size: 22px; font-weight: bold; margin: 10px 0;">${code}</p>

        <p>Kod jest ważny przez 15 minut.</p>

        <hr/>

        <p><strong>Możesz też kliknąć ten link, aby zweryfikować automatycznie:</strong></p>
        <p><a href="${verifyUrl}" target="_blank" style="color: blue; font-size: 18px;">Zweryfikuj e-mail</a></p>

        <p>Jeśli to nie byłeś Ty, zignoruj ten e-mail.</p>
      `,
    });

    console.log("📧 Email enviado, messageId:", info.messageId);

    return NextResponse.json(
      {
        ok: true,
        message:
          "Konto utworzone. Sprawdź e-mail — wysłaliśmy kod oraz link weryfikacyjny.",
        user,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return NextResponse.json(
      { error: "Błąd podczas rejestracji" },
      { status: 500 }
    );
  }
}
