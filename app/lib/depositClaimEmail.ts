import { prisma } from "@/app/lib/prisma";
import { sendMail } from "@/app/lib/mailer";
import { claimReasons, type DepositClaim } from "@/app/lib/depositClaim";

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const money = (cents: number) => new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(cents / 100);

// Called only after the new proposal has committed; SMTP cannot roll back the claim.
export async function notifyDepositClaimProposed(booking: {
  id: string;
  bookingNumber: number;
  renterId: string;
  depositCents: number;
}, claim: DepositClaim) {
  try {
    const renter = await prisma.user.findUnique({ where: { id: booking.renterId }, select: { email: true } });
    if (!renter?.email) throw new Error("Missing renter email");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || process.env.AUTH_URL;
    if (!baseUrl) throw new Error("Missing application URL");
    const url = `${baseUrl.replace(/\/$/, "")}/bookings/${encodeURIComponent(booking.id)}`;
    const subject = `Rezerwacja #${booking.bookingNumber}: propozycja potrącenia z kaucji`;
    const lines = [
      `Właściciel przesłał propozycję rozliczenia kaucji dla rezerwacji #${booking.bookingNumber}.`,
      `Wpłacona kaucja: ${money(booking.depositCents)}`,
      `Proponowane potrącenie: ${money(claim.retainedCents)}`,
      `Proponowany zwrot dla Ciebie: ${money(booking.depositCents - claim.retainedCents)}`,
      `Powód: ${claimReasons[claim.reasonCode]}`,
      `Uzasadnienie: ${claim.reason}`,
      "Otwórz rezerwację, aby zaakceptować propozycję lub przekazać spór do obsługi serwisu.",
      "To propozycja — pieniądze nie zostały jeszcze przekazane ani zwrócone. Kaucja pozostaje zablokowana. Brak odpowiedzi nie oznacza zgody.",
    ];
    await sendMail({
      to: renter.email,
      subject,
      text: `${lines.join("\n\n")}\n\nOtwórz rezerwację: ${url}\n\nZespół MojaSzafa`,
      html: `${lines.map(line => `<p style="white-space:pre-wrap">${escapeHtml(line)}</p>`).join("")}<p><a href="${escapeHtml(url)}">Otwórz rezerwację i odpowiedz</a></p><p>Zespół MojaSzafa</p>`,
    });
  } catch (error) {
    console.error("[DEPOSIT CLAIM MAIL] Proposal saved but notification failed", { bookingId: booking.id, claimId: claim.id }, error);
  }
}
