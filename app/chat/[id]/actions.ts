"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/auth.config";
import { pusherServer } from "@/app/lib/pusher";
import { sendMail } from "@/app/lib/mailer";

const MAX_LEN = 2000;

// ✅ controla si se envían emails desde .env
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === "true";

function getUserIdFromSession(session: unknown): string | undefined {
  if (!session || typeof session !== "object") return undefined;
  if (!("user" in session)) return undefined;

  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== "object") return undefined;

  const id = (user as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
}

function getUserNameFromSession(session: unknown): string | undefined {
  if (!session || typeof session !== "object") return undefined;
  if (!("user" in session)) return undefined;

  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== "object") return undefined;

  const name = (user as { name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

// ✅ Escape seguro para meter texto del usuario dentro de HTML
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ✅ URL estable para emails (por entorno)
function getEmailBaseUrl(): string {
  const raw =
    process.env.APP_URL || // <- pon esto en prod y staging
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";

  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

// ✅ template bonito del email
function buildEmailHtml(params: {
  appName: string;
  messageText: string;
  chatUrl: string;
}): string {
  const { appName, messageText, chatUrl } = params;

  return `
  <div style="margin:0;padding:0;background:#f6f7fb;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Masz nową wiadomość w ${appName}.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                 style="max-width:600px;background:#ffffff;border-radius:16px;box-shadow:0 6px 24px rgba(0,0,0,0.08);overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
            <tr>
              <td style="padding:22px 24px 8px 24px;">
                <div style="font-size:14px;color:#6b7280;">${appName}</div>
                <div style="font-size:22px;line-height:1.25;font-weight:700;color:#111827;margin-top:6px;">
                  Masz nową wiadomość
                </div>
                <div style="font-size:14px;color:#6b7280;margin-top:8px;">
                  Otrzymałeś nową wiadomość w czacie.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 24px 18px 24px;">
                <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;">
                  <div style="font-size:12px;color:#6b7280;margin-bottom:8px;">Treść wiadomości:</div>
                  <div style="font-size:15px;line-height:1.5;color:#111827;white-space:pre-wrap;word-break:break-word;">
                    ${messageText}
                  </div>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 24px 8px 24px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="background:#2563eb;border-radius:12px;">
                      <a href="${chatUrl}"
                         style="display:inline-block;padding:12px 16px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
                        Otwórz czat →
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 24px 22px 24px;">
                <div style="font-size:14px;color:#111827;">
                  Pozdrawiamy,<br><b>Zespół ${appName}</b>
                </div>
                <div style="font-size:12px;color:#6b7280;margin-top:10px;line-height:1.4;">
                  Ta wiadomość została wysłana automatycznie — prosimy na nią nie odpowiadać.
                </div>
              </td>
            </tr>

          </table>

          <div style="max-width:600px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9ca3af;line-height:1.4;padding:10px 8px 0 8px;">
            Jeśli przycisk nie działa, skopiuj i wklej ten link:
            <span style="color:#6b7280;">${chatUrl}</span>
          </div>
        </td>
      </tr>
    </table>
  </div>
  `;
}

export async function sendMessageAction(
  conversationId: string,
  formData: FormData
): Promise<void> {
  const session = await getServerSession(authConfig);
  const userId = getUserIdFromSession(session);
  if (!userId) throw new Error("Brak autoryzacji");

  console.log("[sendMessageAction] start", { conversationId, userId });
  console.log("[sendMessageAction] EMAIL_ENABLED =", EMAIL_ENABLED);

  let text = formData.get("text")?.toString() ?? "";
  text = text.trim().replace(/\r\n/g, "\n");
  if (!text) return;
  if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN);

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      status: true,
      buyer: { select: { id: true, email: true, name: true } },
      seller: { select: { id: true, email: true, name: true } },
    },
  });

  if (!conv) throw new Error("Nie znaleziono rozmowy");

  const isBuyer = userId === conv.buyerId;
  const isSeller = userId === conv.sellerId;
  if (!isBuyer && !isSeller) throw new Error("Brak uprawnień");

  if (conv.status === "CLOSED") {
    throw new Error("Ten czat jest zamknięty. Nie możesz wysyłać wiadomości.");
  }

  const [createdMsg] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId: userId, text },
      select: { id: true, createdAt: true, senderId: true, text: true },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: isBuyer
        ? { buyerLastReadAt: new Date() }
        : { sellerLastReadAt: new Date() },
    }),
  ]);

  const recipient = isBuyer ? conv.seller : conv.buyer;

  console.log("[sendMessageAction] recipient", {
    recipientId: recipient?.id,
    recipientEmail: recipient?.email,
  });

  // ✅ Realtime (no crítico)
  try {
    await pusherServer.trigger(`user-${recipient.id}`, "message:new", {
      conversationId,
      messageId: createdMsg.id,
    });
    await pusherServer.trigger(`conversation-${conversationId}`, "message:new", {
      messageId: createdMsg.id,
    });
  } catch (e) {
    console.error("Pusher trigger failed (ignored):", e);
  }

  // ✅ Email (best-effort)
  if (EMAIL_ENABLED) {
    const baseUrl = getEmailBaseUrl();
    const chatUrl = `${baseUrl}/chat/${conversationId}`;
    const to = recipient?.email || process.env.DEV_FALLBACK_TO || "";

    console.log("[sendMessageAction] email debug", { to, baseUrl });

    if (to) {
      const appName = "Moja Szafa"; // <-- cambia tu marca
      const safeMessageText = escapeHtml(text);

      const html = buildEmailHtml({
        appName,
        messageText: safeMessageText,
        chatUrl,
      });

      try {
        await sendMail({
          to,
          subject: `${appName} — Nowa wiadomość od ${
            getUserNameFromSession(session) ?? "użytkownika"
          }`,
          html,
          text: `Nowa wiadomość:\n\n${text}\n\nOtwórz czat: ${chatUrl}\n\nPozdrawiamy,\nZespół ${appName}\n\nTa wiadomość została wysłana automatycznie — prosimy na nią nie odpowiadać.`,
        });

        console.log("[sendMessageAction] email sent OK");
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);

        if (
          message.includes("unique recipients limit") ||
          message.includes("#MS42225")
        ) {
          console.warn(
            "[sendMessageAction] Email skipped (trial unique recipients limit)"
          );
        } else {
          console.error("[sendMessageAction] sendMail FAILED", e);
        }
      }
    } else {
      console.warn("[sendMessageAction] email NOT sent: empty recipient");
    }
  }

  revalidatePath(`/chat/${conversationId}`);
  revalidatePath(`/chat`);
}

// =========================
// markChatAsRead (sin cambios)
// =========================
export async function markChatAsRead(conversationId: string): Promise<void> {
  const session = await getServerSession(authConfig);
  const userId = getUserIdFromSession(session);
  if (!userId) return;

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { buyerId: true, sellerId: true },
  });
  if (!conv) return;

  if (userId === conv.buyerId) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { buyerLastReadAt: new Date() },
    });
  } else if (userId === conv.sellerId) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { sellerLastReadAt: new Date() },
    });
  }
}
