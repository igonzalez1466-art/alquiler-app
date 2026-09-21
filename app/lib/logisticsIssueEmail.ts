import { prisma } from "@/app/lib/prisma";
import { sendMail } from "@/app/lib/mailer";
import { issueReasonLabel, type IssueDetails } from "@/app/lib/logisticsIssue";

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const datePL = (date: Date) => date.toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short" });

// Send only after the authorized report has been saved successfully.
export async function notifyLogisticsIssue(bookingId: string, stage: "DELIVERY" | "RETURN", issue: IssueDetails) {
  try {
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: {
        id: true, bookingNumber: true, startDate: true, endDate: true,
        listing: { select: { title: true } },
        owner: { select: { id: true, name: true, email: true } },
        renter: { select: { id: true, name: true, email: true } },
      },
    });
    const delivery = stage === "DELIVERY";
    const recipient = delivery ? booking.owner : booking.renter;
    const reporter = delivery ? booking.renter : booking.owner;
    if (reporter.id !== issue.reportedById || recipient.id === reporter.id) throw new Error("Invalid report participants");
    if (!recipient.email) throw new Error("Missing recipient email");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || process.env.AUTH_URL;
    if (!baseUrl) throw new Error("Missing application URL");
    const url = `${baseUrl.replace(/\/$/, "")}/bookings/${encodeURIComponent(booking.id)}`;
    const stageLabel = delivery ? "Dostawa" : "Zwrot";
    const introduction = delivery ? "Najemca zgłosił problem dotyczący dostawy przedmiotu." : "Właściciel zgłosił problem dotyczący zwrotu przedmiotu.";
    const details = [
      ["Rezerwacja", `#${booking.bookingNumber}`],
      ["Przedmiot", booking.listing.title],
      ["Początek wynajmu", datePL(booking.startDate)],
      ["Koniec wynajmu", datePL(booking.endDate)],
      ["Etap", stageLabel],
      ["Zgłaszający", reporter.name || (delivery ? "Najemca" : "Właściciel")],
      ...(issue.reportedAt ? [["Zgłoszono", datePL(new Date(issue.reportedAt))]] : []),
    ];
    const chat = "Możecie skontaktować się ze sobą przez czat na platformie MojaSzafa, aby wyjaśnić problem. Otwórz rezerwację i wybierz „Otwórz czat”.";
    const reason = issueReasonLabel(issue.reason);
    await sendMail({
      to: recipient.email,
      subject: `${stageLabel}: zgłoszono problem — rezerwacja #${booking.bookingNumber}`,
      text: `Cześć ${recipient.name || ""}!\n\n${introduction}\n\n${details.map(([label, value]) => `${label}: ${value}`).join("\n")}\nDaty w czasie polskim.\n\nPowód: ${reason}\nOpis problemu: ${issue.description}\n\n${chat}\n\nOtwórz rezerwację: ${url}\n\nPozdrawiamy,\nZespół MojaSzafa\nTa wiadomość została wysłana automatycznie — prosimy na nią nie odpowiadać.`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#18181b;">
        <p style="margin:0 0 24px;">Cześć ${escapeHtml(recipient.name || "")}!</p>
        <p style="margin:0 0 18px;">${introduction}</p>
        <div style="margin:20px 0;padding:18px;border:1px solid #e4e4e7;border-radius:9px;background:#fafafa;">
          ${details.map(([label, value]) => `<p style="margin:0 0 8px;"><strong>${label}:</strong> ${escapeHtml(value)}</p>`).join("")}
          <p style="margin:0;font-size:12px;color:#71717a;">Daty w czasie polskim.</p>
        </div>
        <div style="margin:20px 0;padding:14px;border:1px solid #fde68a;border-radius:8px;background:#fffbeb;color:#854d0e;">
          <strong>Powód: ${escapeHtml(reason)}</strong>
          <p style="margin:7px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(issue.description)}</p>
        </div>
        <p style="margin:20px 0;">${chat}</p>
        <p style="margin:26px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 18px;border-radius:6px;background:#111827;color:#ffffff;font-weight:700;text-decoration:none;">Otwórz rezerwację</a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
        <p style="margin:0;font-size:13px;color:#555;">Pozdrawiamy,<br/><strong>Zespół MojaSzafa</strong></p>
        <p style="margin-top:6px;font-size:11px;color:#888;">Ta wiadomość została wysłana automatycznie — prosimy na nią nie odpowiadać.</p>
      </div>`,
    });
  } catch (error) {
    console.error("[LOGISTICS ISSUE MAIL] Report saved but notification failed", { bookingId, stage }, error);
  }
}
