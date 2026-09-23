// app/chat/[id]/page.tsx
import Link from "next/link";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/auth.config";
import { markChatAsRead } from "./actions";
import SendMessageForm from "./SendMessageForm";
import { formatChatDateTime } from "@/app/lib/chatDateTime";

type PageProps = { params: Promise<{ id: string }> }; // Next 15: params es Promise

function getUserId(session: unknown): string | undefined {
  if (!session || typeof session !== "object") return undefined;
  if (!("user" in session)) return undefined;

  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== "object") return undefined;

  const id = (user as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
}

export default async function ChatDetailPage({ params }: PageProps) {
  const { id } = await params; // conversationId

  const session = await getServerSession(authConfig);

  const userId = getUserId(session);
  if (!userId) {
    return <p className="p-6">Musisz się zalogować, aby zobaczyć ten czat.</p>;
  }

  const convo = await prisma.conversation.findUnique({
    where: { id },
    include: {
      listing: { select: { id: true, title: true } },
      buyer: { select: { id: true, name: true, image: true } },
      seller: { select: { id: true, name: true, image: true } },
      messages: {
        include: { sender: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!convo) return <p className="p-6">Nie znaleziono rozmowy.</p>;
  if (userId !== convo.buyerId && userId !== convo.sellerId) {
    return <p className="p-6">Brak uprawnień do tego czatu.</p>;
  }

  // ✅ Marca como leído para el usuario que abre el chat
  await markChatAsRead(id);

  const other = userId === convo.buyerId ? convo.seller : convo.buyer;

  // ✅ Detectar si el chat está cerrado
  const convoStatus = (convo as unknown as { status?: unknown }).status;
  const isClosed = convoStatus === "CLOSED";

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
      <Link href="/chat" className="inline-flex text-sm font-medium text-indigo-700 hover:underline">← Wróć do czatów</Link>

      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
          {other?.name?.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-gray-900">{other?.name ?? "Użytkownik"}</h1>
          <Link href={`/listing/${convo.listing.id}`} className="block truncate text-sm font-medium text-indigo-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
            Artykuł: {convo.listing.title} ↗
          </Link>
        </div>
        {isClosed && <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">Zamknięty</span>}
      </div>

      {isClosed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ten czat jest zamknięty. Nie możesz wysyłać wiadomości.
        </div>
      )}

      <div className="min-h-72 space-y-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-3 sm:p-5">
        {convo.messages.length === 0 && (
          <div className="py-14 text-center">
            <p className="font-semibold text-gray-900">Rozpocznij rozmowę</p>
            <p className="mt-1 text-sm text-gray-600">Napisz wiadomość dotyczącą tego przedmiotu.</p>
          </div>
        )}

        {convo.messages.map((m, index) => {
          const mine = m.senderId === userId;
          const messageDay = m.createdAt.toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
          const previousDay = index > 0 ? convo.messages[index - 1].createdAt.toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" }) : null;
          const stamp = formatChatDateTime(m.createdAt);

          return (
            <div key={m.id} className="space-y-3">
              {messageDay !== previousDay && <div className="flex items-center gap-3 py-1 text-xs text-gray-500">
                <span className="h-px flex-1 bg-gray-200" />
                <span>{m.createdAt.toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "long", year: "numeric" })}</span>
                <span className="h-px flex-1 bg-gray-200" />
              </div>}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] break-words rounded-2xl px-4 py-3 shadow-sm sm:max-w-[75%] ${mine ? "rounded-br-sm bg-indigo-600 text-white" : "rounded-bl-sm border border-gray-200 bg-white text-gray-900"}`}>
                  <p className={`mb-1 text-xs font-semibold ${mine ? "text-indigo-100" : "text-indigo-700"}`}>
                    {mine ? "Ty" : m.sender.name ?? "Użytkownik"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>
                  <p className={`mt-2 text-right text-xs ${mine ? "text-indigo-100" : "text-gray-500"}`}>{stamp}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <SendMessageForm conversationId={id} isClosed={isClosed} />
    </div>
  );
}

