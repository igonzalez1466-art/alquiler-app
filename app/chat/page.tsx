// app/chat/page.tsx
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authConfig } from "@/auth.config";
import Link from "next/link";
import { formatChatDateTime } from "@/app/lib/chatDateTime";

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
      messages: { some: {} },
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Wiadomości</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">Twoje czaty</h1>
        <p className="mt-2 text-sm text-gray-600">Rozmowy o przedmiotach w MojaSzafa.</p>
      </div>

      {sorted.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="font-semibold text-gray-900">Nie masz jeszcze żadnych rozmów.</p>
          <p className="mt-1 text-sm text-gray-600">Gdy napiszesz do właściciela przedmiotu, rozmowa pojawi się tutaj.</p>
          <Link href="/listing" className="mt-4 inline-block text-sm font-semibold text-indigo-700 hover:underline">Przeglądaj ogłoszenia →</Link>
        </div>
      )}

      <ul className="space-y-3">
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

          return <li key={c.id}>
            <Link href={`/chat/${c.id}`} className={`flex gap-3 rounded-2xl border p-4 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:gap-4 ${hasUnread ? "border-indigo-200 bg-indigo-50/30" : "border-gray-200 bg-white"}`}>
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-700">
                {other?.name?.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={`truncate text-gray-900 ${hasUnread ? "font-bold" : "font-semibold"}`}>{other?.name ?? "Użytkownik"}</span>
                  {hasUnread && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white">Nowa wiadomość</span>}
                  {isClosed && <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">Zamknięty</span>}
                </span>
                <span className="block truncate text-xs font-medium text-indigo-700">{c.listing.title}</span>
                <span className={`block truncate text-sm ${hasUnread ? "text-gray-800" : "text-gray-600"}`}>
                  {lastMsg ? `${lastMsg.senderId === userId ? "Ty" : lastMsg.sender.name ?? "Użytkownik"}: ${lastMsg.text}` : "Brak wiadomości"}
                </span>
              </span>
              {lastMsg && <span className="shrink-0 self-start whitespace-nowrap text-xs text-gray-500">{formatChatDateTime(lastMsg.createdAt)}</span>}
            </Link>
          </li>;
        })}
      </ul>
    </div>
  );
}

