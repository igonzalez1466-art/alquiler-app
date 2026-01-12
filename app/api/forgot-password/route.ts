// app/api/forgot-password/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendMail } from "@/app/lib/mailer"; // acepta {to, subject, html}
import crypto from "crypto";

function baseUrl() {
  // Asegúrate que coincide con el puerto real (3000/3001)
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json().catch(() => ({ email: "" }));

    if (!email) {
      return NextResponse.json({ message: "Email requerido" }, { status: 400 });
    }

    // Respuesta genérica: no filtramos si existe o no
    const generic = {
      message: "Jeśli podany adres e-mail istnieje, otrzymasz link do zresetowania hasła.",
    };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log("FORGOT → email address not found:", email);
      return NextResponse.json(generic);
    }

    // Borra tokens previos de este email (evita colisiones/duplicados)
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });

    // Crea token (1 hora)
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires: new Date(Date.now() + 1000 * 60 * 60),
      },
    });

    const resetUrl = `${baseUrl()}/reset-password?token=${token}`;
    console.log("FORGOT → resetUrl:", resetUrl);

    // Envía el correo (Mailtrap/Gmail según .env)
    await sendMail({
      to: email,
      subject: "Reset hasła",
      html: `
        <div style="font-family: system-ui, Segoe UI, Arial">
          <h2>Odzyskaj hasło</h2>
          <p>Kliknij przycisk (lub użyj linku), aby zresetować hasło.</p>
          <p>
            <a href="${resetUrl}"
               style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none">
              Odzyskiwanie hasła
            </a>
          </p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p style="color:#6b7280">Ten link wygaśnie za 60 minut.</p>
        </div>
      `,
    });

    console.log("FORGOT → email sent to:", email);
    return NextResponse.json(generic);
  } catch (err) {
    console.error("FORGOT → error:", err);
    return NextResponse.json({ message: "Wystąpił błąd wewnętrzny. Spróbuj ponownie później" }, { status: 500 });
  }
}
