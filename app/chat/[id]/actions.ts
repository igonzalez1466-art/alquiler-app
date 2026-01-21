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

export async function sendMessageAction(
  conversationId: string,
  formData: FormData
): Promise<void> {
  const session = await getServerSession(authConfig);
  const userId = getUserIdFromSession(session);
  if (!userId) throw new Error("Brak autoryzacji");

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

  // ✅ Si el chat está cerrado, no permitimos enviar
  // IMPORTANTE: no devolver objetos desde una action usada en <form action={...}>
  if (conv.status === "CLOSED") {
    throw new Error("CHAT_CLOSED");
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

  await pusherServer.trigger(`user-${recipient.id}`, "message:new", {
    conversationId,
    messageId: createdMsg.id,
  });
  await pusherServer.trigger(`conversation-${conversationId}`, "message:new", {
    messageId: createdMsg.id,
  });

  // ✅ Email notification: best-effort (NO romper el chat si falla)
  if (EMAIL_ENABLED) {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const to = recipient?.email || process.env.DEV_FALLBACK_TO || "";

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
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);

        // ✅ Ignora el límite del trial para no ensuciar la UX
        if (
          message.includes("unique recipients limit") ||
          message.includes("#MS42225")
        ) {
          console.warn("Email skipped (trial unique recipients limit).");
        } else {
          console.error("sendMail failed (ignored):", e);
        }
      }
    }
  }

  revalidatePath(`/chat/${conversationId}`);
  revalidatePath(`/chat`);
}

// ✅ markChatAsRead sin cambios funcionales (solo userId robusto)
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
