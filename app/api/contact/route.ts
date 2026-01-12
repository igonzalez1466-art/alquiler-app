import { NextResponse } from "next/server";
import { sendMail } from "@/app/lib/mailer";

export async function POST(req: Request) {
  try {
    const { name, email, bookingNumber, message } =
      await req.json().catch(() => ({}));

    if (!name || !email || !message) {
      return NextResponse.json(
        { message: "Imię, e-mail i wiadomość są wymagane" },
        { status: 400 }
      );
    }

    // logs para depurar en el servidor
    console.log("CONTACT → recibido:", {
      name,
      email,
      bookingNumber,
      message,
    });

    await sendMail({
      to: "igonzalez1466@gmail.com", // o kontakt@mojaszafa.com
      subject: `Nowa wiadomość kontaktowa od ${name}`,
      html: `
        <div style="font-family:system-ui,Arial">
          <p><strong>Imię:</strong> ${name}</p>
          <p><strong>E-mail:</strong> ${email}</p>
          <p><strong>Numer rezerwacji:</strong> ${
            bookingNumber?.trim() || "—"
          }</p>
          <hr/>
          <p><strong>Wiadomość:</strong><br/>${message}</p>
        </div>
      `,
      from: `"${name}" <${email}>`, // opcional
    });

    return NextResponse.json({ message: "Wiadomość wysłana poprawnie" });
  } catch (err) {
    console.error("CONTACT → error:", err);
    return NextResponse.json(
      { message: "Błąd podczas wysyłania wiadomości" },
      { status: 500 }
    );
  }
}
