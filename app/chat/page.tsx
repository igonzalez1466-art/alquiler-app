// app/chat/page.tsx
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/auth.config";
import Link from "next/link";

function getUserId(session: unknown): string | undefined {
  if (!session || typeof session !== "object") return undefined;
  if (!("user" in session)) return undefined;

  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== "object") return undefined;

  const id = (user as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
}

export default async function ChatInboxPage() {
  const session = await getServerSession(authConfig);
  const userId = getUserId(session);

  if (!userId) {
    return <p className="p-6">Musisz się zalogować, aby zobaczyć czaty.</p>;
  }

  // ✅ Traer conversaciones con último mensaje
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
    },
    include: {
      listing: { select: { title: true } },
      buyer: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { sender: { select: { id: true, name: true } } },
      },
    },
  });

  // ✅ Ordenar por último mensaje
  const sorted = conversations.sort((a, b) => {
    const dateA = a.messages[0]?.createdAt ?? a.createdAt;
    const dateB = b.messages[0]?.createdAt ?? b.createdAt;
    return dateB.getTime() - dateA.getTime();
  });

  // 🔧 Formato “Dzisiaj / Wczoraj / data”
  function formatDateTime(date: Date) {
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
      <h1 className="text-2xl font-semibold mb-4">Twoje czaty</h1>

      {sorted.length === 0 && (
        <p className="text-gray-500">Nie masz jeszcze żadnych rozmów.</p>
      )}

      <ul className="divide-y border rounded bg-white">
        {sorted.map((c) => {
          const lastMsg = c.messages[0];
          const other = userId === c.buyerId ? c.seller : c.buyer;

          // ✅ Calcular si hay mensajes no leídos
          let hasUnread = false;
          if (lastMsg) {
            if (userId === c.buyerId) {
              hasUnread =
                lastMsg.createdAt > (c.buyerLastReadAt ?? new Date(0)) &&
                lastMsg.sender.id !== userId;
            } else if (userId === c.sellerId) {
              hasUnread =
                lastMsg.createdAt > (c.sellerLastReadAt ?? new Date(0)) &&
                lastMsg.sender.id !== userId;
            }
          }

          // ✅ Si está cerrado, lo marcamos visualmente (sin any)
          const status = (c as unknown as { status?: unknown }).status;
          const isClosed = status === "CLOSED";

          return (
            <li
              key={c.id}
              className={`p-4 flex justify-between items-center ${
                isClosed ? "bg-gray-50" : "hover:bg-gray-50"
              }`}
            >
              <div className="min-w-0">
                <Link
                  href={`/chat/${c.id}`}
                  className="font-medium text-blue-600 hover:underline flex items-center gap-2"
                >
                  <span className="truncate">{other?.name ?? "Użytkownik"}</span>

                  {hasUnread && <span className="text-red-500 text-lg">●</span>}

                  {isClosed && (
                    <span className="text-[11px] px-2 py-0.5 rounded border bg-gray-100 text-gray-700">
                      Zamknięty
                    </span>
                  )}
                </Link>

                <p className="text-sm text-gray-600 truncate">{c.listing.title}</p>

                {lastMsg ? (
                  <p className="text-sm text-gray-500 truncate">
                    {lastMsg.sender.name ?? "Użytkownik"}: {lastMsg.text.slice(0, 60)}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">Brak wiadomości</p>
                )}
              </div>

              {lastMsg && (
                <span className="text-xs text-gray-500 whitespace-nowrap pl-3">
                  {formatDateTime(lastMsg.createdAt)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
