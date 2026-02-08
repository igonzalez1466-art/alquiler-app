"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/auth.config";
import { pusherServer } from "@/app/lib/pusher";
import { sendMail } from "@/app/lib/mailer";

const MAX_LEN = 2000;

// ✅ controla si se envían emails desde .env
// Pon EMAIL_ENABLED="false" en desarrollo para que nunca moleste.
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

// ✅ URL estable para emails (no usar NEXTAUTH_URL aquí)
function getEmailBaseUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";

  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export async function sendMessageAction(
  conversationId: string,
  formData: FormData
): Promise<void> {
  const session = await getServerSession(authConfig);
  const userId = getUserIdFromSession(session);
  if (!userId) throw new Error("Brak autoryzacji");

  // 🔍 LOG 1: entrada + flag de email
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
      closedReason: true,
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

  // 🔍 LOG 2: destinatario
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

  // ✅ Email notification (best-effort)
  if (EMAIL_ENABLED) {
    const baseUrl = getEmailBaseUrl();
    const to = recipient?.email || process.env.DEV_FALLBACK_TO || "";

    // 🔍 LOG 3: datos del email
    console.log("[sendMessageAction] email debug", {
      to,
      baseUrl,
    });

    if (to) {
      try {
        await sendMail({
          to,
          subject: `Nowa wiadomość od ${
            getUserNameFromSession(session) ?? "użytkownika"
          }`,
          html: `
            <p>Masz nową wiadomość w <b>Moja Szafa</b>:</p>
            <blockquote>${text.replace(/</g, "&lt;")}</blockquote>
            <p><a href="${baseUrl}/chat/${conversationId}">Otwórz czat</a></p>
          `,
          text: `Nowa wiadomość:\n\n${text}\n\nOtwórz czat: ${baseUrl}/chat/${conversationId}`,
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
