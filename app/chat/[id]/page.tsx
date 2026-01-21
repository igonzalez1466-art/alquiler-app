// app/chat/[id]/page.tsx
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/auth.config";
import { sendMessageAction, markChatAsRead } from "./actions";

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
      listing: { select: { title: true } },
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

  function formatDateTime(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    let dayLabel: string;
    if (msgDate.getTime() === today.getTime()) {
      dayLabel = "Dzisiaj";
    } else if (msgDate.getTime() === yesterday.getTime()) {
      dayLabel = "Wczoraj";
    } else {
      dayLabel = date.toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
      });
    }

    const timeLabel = date.toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return `${dayLabel} ${timeLabel}`;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">
        Artykuł: <span className="font-bold">{convo.listing.title}</span>
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
          const stamp = formatDateTime(new Date(m.createdAt));

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

      <form action={sendMessageAction.bind(null, id)} className="flex gap-2">
        <input
          type="text"
          name="text"
          placeholder={isClosed ? "Czat zamknięty" : "Napisz wiadomość…"}
          className="flex-1 border rounded px-3 py-2"
          required={!isClosed}
          disabled={isClosed}
        />
        <button
          type="submit"
          disabled={isClosed}
          className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
        >
          Wyślij
        </button>
      </form>
    </div>
  );
}
