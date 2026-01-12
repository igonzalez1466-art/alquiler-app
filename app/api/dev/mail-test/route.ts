// app/api/dev/mail-test/route.ts
import { NextResponse } from "next/server";
import { sendEmail } from "@/app/lib/mailer";

export async function GET() {
  try {
    await sendEmail({
      to: process.env.SMTP_USER || "", // en Mailtrap vale como destino
      subject: "Prueba de email",
      html: "<h1>Funciona 🎉</h1><p>Este es un email de prueba.</p>",
      text: "Funciona!",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("mail-test error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
