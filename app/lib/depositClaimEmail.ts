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
    const renter = await prisma.user.findUnique({ where: { id: booking.renterId }, select: { email: true, name: true } });
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
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#18181b;">
          <p style="margin:0 0 24px;color:#18181b;">Cześć ${escapeHtml(renter.name || "")}!</p>
          <p style="margin:0 0 18px;color:#18181b;">
            Właściciel przesłał propozycję rozliczenia kaucji dla rezerwacji <strong>#${booking.bookingNumber}</strong>.
          </p>
          <div style="margin:20px 0;padding:18px;border:1px solid #e4e4e7;border-radius:9px;background:#fafafa;">
            <p style="margin:0 0 14px;font-size:17px;color:#18181b;"><strong>Propozycja rozliczenia kaucji</strong></p>
            <p style="margin:0 0 8px;color:#18181b;"><strong>Pobrana kaucja:</strong> ${money(booking.depositCents)}</p>
            <p style="margin:0 0 8px;color:#166534;"><strong>Proponowany zwrot dla Ciebie:</strong> ${money(booking.depositCents - claim.retainedCents)}</p>
            <p style="margin:0;color:#991b1b;"><strong>Proponowane potrącenie:</strong> ${money(claim.retainedCents)}</p>
          </div>
          <div style="margin:20px 0;padding:14px;border:1px solid #fde68a;border-radius:8px;background:#fffbeb;color:#854d0e;">
            <strong>Powód proponowanego potrącenia: ${escapeHtml(claimReasons[claim.reasonCode])}</strong>
            <p style="margin:7px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(claim.reason)}</p>
          </div>
          <p style="margin:20px 0;color:#18181b;">Otwórz rezerwację, aby zaakceptować propozycję lub przekazać spór do obsługi serwisu.</p>
          <p style="margin:26px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 18px;border-radius:6px;background:#111827;color:#ffffff;font-weight:700;text-decoration:none;">Otwórz rezerwację i odpowiedz</a></p>
          <div style="margin:20px 0;padding:14px;border:1px solid #fde68a;border-radius:8px;background:#fffbeb;color:#854d0e;">
            <strong>Ważne:</strong><br/>
            To propozycja — pieniądze nie zostały jeszcze przekazane ani zwrócone. Kaucja pozostaje zablokowana. Brak odpowiedzi nie oznacza zgody.
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
          <p style="margin:0;font-size:13px;color:#555;">Pozdrawiamy,<br/><strong>Zespół MojaSzafa</strong></p>
          <p style="margin-top:6px;font-size:11px;color:#888;">Ta wiadomość została wysłana automatycznie — prosimy na nią nie odpowiadać.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("[DEPOSIT CLAIM MAIL] Proposal saved but notification failed", { bookingId: booking.id, claimId: claim.id }, error);
  }
}

// Called only after the renter's acceptance has committed; SMTP cannot roll back the decision.
export async function notifyDepositClaimAccepted(booking: {
  id: string;
  bookingNumber: number;
  ownerId: string;
  depositCents: number;
}, claim: DepositClaim) {
  try {
    const owner = await prisma.user.findUnique({ where: { id: booking.ownerId }, select: { email: true, name: true } });
    if (!owner?.email) throw new Error("Missing owner email");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || process.env.AUTH_URL;
    if (!baseUrl) throw new Error("Missing application URL");
    const url = `${baseUrl.replace(/\/$/, "")}/bookings/${encodeURIComponent(booking.id)}`;
    const retainedCents = claim.approvedRetainedCents ?? claim.retainedCents;
    const refundCents = Math.max(0, booking.depositCents - retainedCents);
    const subject = `Rezerwacja #${booking.bookingNumber}: najemca zaakceptował potrącenie z kaucji`;
    const lines = [
      `Najemca zaakceptował propozycję potrącenia z kaucji dla rezerwacji #${booking.bookingNumber}.`,
      `Wpłacona kaucja: ${money(booking.depositCents)}`,
      `Zaakceptowane potrącenie: ${money(retainedCents)}`,
      `Zwrot kaucji najemcy: ${money(refundCents)}`,
      `Powód: ${claimReasons[claim.reasonCode]}`,
      `Uzasadnienie: ${claim.reason}`,
      "Otwórz rezerwację i wykonaj zatwierdzone rozliczenie, aby zakończyć transakcję.",
      "Zgoda została zapisana, ale środki nie zostały jeszcze rozliczone.",
    ];
    await sendMail({
      to: owner.email,
      subject,
      text: `${lines.join("\n\n")}\n\nRozlicz rezerwację: ${url}\n\nZespół MojaSzafa`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#18181b;">
          <p style="margin:0 0 24px;color:#18181b;">Cześć ${escapeHtml(owner.name || "")}!</p>
          <p style="margin:0 0 18px;color:#18181b;">
            Najemca zaakceptował propozycję potrącenia z kaucji dla rezerwacji <strong>#${booking.bookingNumber}</strong>.
          </p>
          <div style="margin:20px 0;padding:18px;border:1px solid #e4e4e7;border-radius:9px;background:#fafafa;">
            <p style="margin:0 0 14px;font-size:17px;color:#18181b;"><strong>Zaakceptowane rozliczenie kaucji</strong></p>
            <p style="margin:0 0 8px;color:#18181b;"><strong>Pobrana kaucja:</strong> ${money(booking.depositCents)}</p>
            <p style="margin:0 0 8px;color:#166534;"><strong>Potrącenie dla Ciebie:</strong> ${money(retainedCents)}</p>
            <p style="margin:0;color:#18181b;"><strong>Zwrot kaucji najemcy:</strong> ${money(refundCents)}</p>
          </div>
          <div style="margin:20px 0;padding:14px;border:1px solid #e4e4e7;border-radius:8px;background:#fafafa;color:#18181b;">
            <strong>Powód potrącenia: ${escapeHtml(claimReasons[claim.reasonCode])}</strong>
            <p style="margin:7px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(claim.reason)}</p>
          </div>
          <div style="margin:20px 0;padding:14px;border:1px solid #bbf7d0;border-radius:8px;background:#f0fdf4;color:#166534;">
            <strong>Zgoda najemcy została zapisana.</strong><br/>
            Otwórz rezerwację i wykonaj zatwierdzone rozliczenie, aby zakończyć transakcję.
          </div>
          <p style="margin:26px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 18px;border-radius:6px;background:#111827;color:#ffffff;font-weight:700;text-decoration:none;">Rozlicz rezerwację</a></p>
          <div style="margin:20px 0;padding:14px;border:1px solid #fde68a;border-radius:8px;background:#fffbeb;color:#854d0e;">
            <strong>Ważne:</strong><br/>
            Środki nie zostały jeszcze rozliczone. Zaloguj się do MojaSzafa i zakończ rozliczenie rezerwacji.
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
          <p style="margin:0;font-size:13px;color:#555;">Pozdrawiamy,<br/><strong>Zespół MojaSzafa</strong></p>
          <p style="margin-top:6px;font-size:11px;color:#888;">Ta wiadomość została wysłana automatycznie — prosimy na nią nie odpowiadać.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("[DEPOSIT CLAIM MAIL] Acceptance saved but owner notification failed", { bookingId: booking.id, claimId: claim.id }, error);
  }
}
