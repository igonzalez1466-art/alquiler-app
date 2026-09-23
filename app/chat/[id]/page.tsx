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
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">
        Artykuł:{" "}
        <Link
          href={`/listing/${convo.listing.id}`}
          className="font-bold text-indigo-700 underline underline-offset-4 hover:text-indigo-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 [overflow-wrap:anywhere]"
        >
          {convo.listing.title}
        </Link>
      </h1>
      <p className="text-sm text-gray-600">Czat z {other?.name ?? "Użytkownik"}</p>

      {isClosed && (
        <div className="border rounded bg-amber-50 text-amber-900 px-3 py-2 text-sm">
          Ten czat jest zamknięty. Nie możesz wysyłać wiadomości.
        </div>
      )}

      <div className="space-y-2 border rounded p-3 bg-white">
        {convo.messages.length === 0 && (
          <p className="text-gray-500 text-sm">Brak wiadomości.</p>
        )}

        {convo.messages.map((m) => {
          const mine = m.senderId === userId;
          const stamp = formatChatDateTime(m.createdAt);

          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded px-3 py-2 break-words ${
                  mine ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-900"
                }`}
              >
                <div className="text-xs opacity-80 mb-1">
                  {m.sender.name ?? (mine ? "Ty" : "Użytkownik")}
                </div>

                <div className="whitespace-pre-wrap">{m.text}</div>

                <div
                  className={`mt-1 flex justify-end text-xs ${
                    mine ? "text-white/90" : "text-gray-600"
                  }`}
                >
                  {stamp}
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

