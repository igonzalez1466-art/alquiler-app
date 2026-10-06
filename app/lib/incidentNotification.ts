import type { Incident, Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { sendMail } from "@/app/lib/mailer";
import { canActOnIncident, incidentReasons } from "@/app/lib/incidentPolicy";

type Event = "opened" | "proposed" | "rejected" | "accepted" | "evidence" | "photos" | "escalated" | "retry" | "resolved";
const titles: Record<Event, string> = {
  opened: "Nowe zgłoszenie", proposed: "Nowa propozycja rozwiązania", rejected: "Propozycja została odrzucona",
  accepted: "Propozycja została zaakceptowana", evidence: "Nowy dowód / komentarz", photos: "Dodano zdjęcia",
  escalated: "Prośba o wyjaśnienie sprawy", retry: "Ponowiono sprawdzenie rozliczenia", resolved: "Zgłoszenie zakończone — rozwiązanie zaakceptowane przez obie strony",
};
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

/** Record immutable email snapshots in the same transaction as the action. */
export async function queueIncidentEmail(tx: Prisma.TransactionClient, incident: Incident, event: Event, actorId: string | null, key: string, detail = "") {
  if (event === "resolved" && (!incident.acceptedAt || incident.status !== "RESOLVED")) return;
  const b = await tx.booking.findUniqueOrThrow({ where: { id: incident.bookingId }, include: {
    owner: { select: { id: true, name: true, email: true } }, renter: { select: { id: true, name: true, email: true } }, listing: { select: { title: true } },
  } });
  if (actorId && actorId !== b.ownerId && actorId !== b.renterId) throw new Error("Nieprawidłowy autor powiadomienia.");
  const recipients = event === "resolved" ? [b.owner, b.renter] : [actorId === b.ownerId ? b.renter : b.owner];
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || process.env.AUTH_URL;
  const actor = actorId === b.ownerId ? "Właściciel" : "Najemca";
  for (const recipient of recipients) {
    if (!recipient.email) { console.error("[INCIDENT EMAIL] Missing recipient address", incident.id, recipient.id); continue; }
    const title = titles[event];
    const next = incident.status === "RESOLVED" ? "Sprawa została zakończona. Rozwiązanie zaakceptowały obie strony."
      : incident.status === "AGREEMENT_REACHED" ? "Obie strony zaakceptowały rozwiązanie. Rozliczenie Stripe jest w toku."
      : canActOnIncident(incident, recipient.id === b.ownerId) ? "Teraz Twoja kolej. Otwórz zgłoszenie i podejmij działanie."
      : `Czekamy na działanie ${canActOnIncident(incident, true) ? "właściciela" : "najemcy"}. Możesz sprawdzić aktualny stan zgłoszenia.`;
    const refund = incident.stage === "DELIVERY" && incident.refundCents !== null
      ? `${event === "resolved" || incident.acceptedAt ? "Uzgodniony zwrot najmu" : "Proponowany zwrot najmu"}: ${new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(incident.refundCents / 100)}.` : "";
    const text = [title, `Rezerwacja #${b.bookingNumber ?? b.id}: ${b.listing.title}`,
      `Etap: ${incident.stage === "DELIVERY" ? "Dostawa" : "Zwrot"}. Powód: ${incidentReasons[incident.reason]}.`,
      event === "resolved" ? "" : `${actor}: ${detail || title}.`, incident.description,
      incident.resolution ? `Rozwiązanie: ${incident.resolution}` : "", refund, next,
      incident.stage === "RETURN" ? "Zgłoszenie zwrotu nie zmienia należnego wynagrodzenia za najem. MojaSzafa nie ustala odszkodowania ani winy." : "",
    ].filter(Boolean).join("\n\n");
    // Resolve the current application URL at send time if the deployment was not configured yet.
    const url = baseUrl ? `${baseUrl.replace(/\/$/, "")}/account/incidents/${encodeURIComponent(b.id)}` : "__INCIDENT_URL__";
    const greeting = `Cześć${recipient.name ? " " + recipient.name : ""}!`;
    const footer = "Pozdrawiamy,\nZespół MojaSzafa\n\nTa wiadomość została wysłana automatycznie — prosimy na nią nie odpowiadać.";
    const fullText = `${greeting}\n\n${text}\n\nOtwórz zgłoszenie: ${url}\n\n${footer}`;
    const details = [
      ["Rezerwacja", `#${b.bookingNumber ?? b.id}`], ["Przedmiot", b.listing.title],
      ["Etap", incident.stage === "DELIVERY" ? "Dostawa" : "Zwrot"], ["Powód", incidentReasons[incident.reason]],
      ["Data powiadomienia", new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })],
    ];
    const buttonLabel = canActOnIncident(incident, recipient.id === b.ownerId) ? "Otwórz zgłoszenie i odpowiedz" : "Zobacz zgłoszenie i uzgodnienia";
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#18181b;max-width:640px;">
      <p style="margin:0 0 24px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 18px;"><strong>${escapeHtml(title)}</strong> — rezerwacja <strong>#${escapeHtml(String(b.bookingNumber ?? b.id))}</strong>.</p>
      ${event !== "resolved" ? `<p style="margin:0 0 18px;white-space:pre-wrap;overflow-wrap:anywhere;"><strong>${actor}:</strong> ${escapeHtml(detail || title)}</p>` : ""}
      <div style="margin:20px 0;padding:18px;border:1px solid #e4e4e7;border-radius:9px;background:#fafafa;">
        <p style="margin:0 0 14px;font-size:17px;"><strong>Podsumowanie zgłoszenia</strong></p>
        ${details.map(([label, value]) => `<p style="margin:0 0 8px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join("")}
        <p style="margin:12px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;"><strong>Opis problemu:</strong> ${escapeHtml(incident.description)}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#71717a;">Daty w czasie polskim. Stan opisany w wiadomości odpowiada chwili działania; aktualny stan znajdziesz pod przyciskiem poniżej.</p>
      </div>
      ${incident.resolution || refund ? `<div style="margin:20px 0;padding:18px;border:1px solid #c7d2fe;border-radius:9px;background:#eef2ff;">
        <p style="margin:0 0 14px;font-size:17px;"><strong>${incident.acceptedAt ? "Uzgodnione rozwiązanie" : "Propozycja rozwiązania"}</strong></p>
        ${incident.resolution ? `<p style="margin:0 0 10px;white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(incident.resolution)}</p>` : ""}
        ${refund ? `<p style="margin:0;"><strong>${escapeHtml(refund)}</strong></p>` : ""}
      </div>` : ""}
      <div style="margin:20px 0;padding:14px;border:1px solid #e4e4e7;border-radius:8px;background:#fafafa;">
        <strong>${event === "resolved" ? "Zakończenie sprawy" : "Następny krok"}</strong><p style="margin:7px 0 0;">${escapeHtml(next)}</p>
      </div>
      ${incident.stage === "RETURN" ? '<p style="margin:0 0 20px;font-size:12px;color:#71717a;">Zgłoszenie zwrotu nie zmienia należnego wynagrodzenia za najem. MojaSzafa nie ustala odszkodowania ani winy.</p>' : ""}
      <p style="margin:26px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 18px;border-radius:6px;background:#111827;color:#ffffff;font-weight:700;text-decoration:none;">${buttonLabel}</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
      <p style="margin:0;font-size:13px;color:#555;">Pozdrawiamy,<br/><strong>Zespół MojaSzafa</strong></p>
      <p style="margin-top:6px;font-size:11px;color:#888;">Ta wiadomość została wysłana automatycznie — prosimy na nią nie odpowiadać.</p>
    </div>`;
    await tx.incidentNotification.upsert({ where: { eventKey: `${key}:${recipient.id}` }, create: {
      incidentId: incident.id, recipientId: recipient.id, eventKey: `${key}:${recipient.id}`, to: recipient.email,
      subject: `${title} — rezerwacja #${b.bookingNumber ?? b.id}`, text: fullText, html,
    }, update: {} });
  }
}

/** SMTP failures do not roll back actions. Leases prevent concurrent workers sending the same event. */
export async function sendPendingIncidentEmails(bookingId?: string) {
  try {
    const now = new Date();
    const pending = await prisma.incidentNotification.findMany({ where: { sentAt: null, nextAttemptAt: { lte: now },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }], ...(bookingId ? { incident: { bookingId } } : {}) },
      include: { incident: { select: { bookingId: true } } }, orderBy: { createdAt: "asc" }, take: 10 });
    for (const email of pending) {
      const leaseUntil = new Date(Date.now() + 5 * 60000);
      const claim = await prisma.incidentNotification.updateMany({ where: { id: email.id, sentAt: null, nextAttemptAt: { lte: new Date() },
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }] }, data: { leaseUntil, attempts: { increment: 1 } } });
      if (!claim.count) continue;
      try {
        if (!process.env.APP_URL && !process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXTAUTH_URL && !process.env.AUTH_URL) throw new Error("Application URL missing");
        const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || process.env.AUTH_URL;
        const url = `${baseUrl!.replace(/\/$/, "")}/account/incidents/${encodeURIComponent(email.incident.bookingId)}`;
        await sendMail({ to: email.to, subject: email.subject, text: email.text.replaceAll("__INCIDENT_URL__", url), html: email.html.replaceAll("__INCIDENT_URL__", escapeHtml(url)) });
        await prisma.incidentNotification.updateMany({ where: { id: email.id, leaseUntil, sentAt: null }, data: { sentAt: new Date(), leaseUntil: null, lastError: null } });
      } catch {
        await prisma.incidentNotification.updateMany({ where: { id: email.id, leaseUntil, sentAt: null }, data: {
          leaseUntil: null, lastError: "Email delivery failed; retry scheduled", nextAttemptAt: new Date(Date.now() + Math.min(60, 2 ** Math.min(email.attempts + 1, 6)) * 60000),
        } });
        console.error("[INCIDENT EMAIL] Delivery requires retry", email.id);
      }
    }
  } catch (error) { console.error("[INCIDENT EMAIL] Queue requires retry", error); }
}
