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
    const fullText = `${text}${url ? `\n\n${url}` : ""}\n\nZespół MojaSzafa`;
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>${escapeHtml(title)}</h2><p style="white-space:pre-wrap">${escapeHtml(text)}</p>${url ? `<p><a href="${escapeHtml(url)}">${canActOnIncident(incident, recipient.id === b.ownerId) ? "Otwórz zgłoszenie i odpowiedz" : "Zobacz zgłoszenie i uzgodnienia"}</a></p>` : ""}<p>Zespół MojaSzafa</p></div>`;
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
