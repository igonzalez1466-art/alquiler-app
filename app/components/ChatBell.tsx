// app/components/ChatBell.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPusherClient } from "@/app/lib/pusher-client";

type Props = { userId: string };

export default function ChatBell({ userId }: Props) {
  const [total, setTotal] = useState<number>(0);
  const router = useRouter();

  // Pide al server el total de no leídos
  const fetchUnread = async () => {
    try {
      const res = await fetch("/api/chat/unread-total", { cache: "no-store" });
      const data = await res.json();
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch {
      // opcional: console.error
    }
  };

  useEffect(() => {
    let mounted = true;

    // Carga inicial
    fetchUnread();

    const pusher = getPusherClient();

    // ✅ Si no hay Pusher (env vars faltan en Preview), no rompemos la app.
    // Fallback: polling cada 15s para actualizar el badge.
    if (!pusher) {
      const id = setInterval(() => {
        if (mounted) fetchUnread();
      }, 15000);

      return () => {
        mounted = false;
        clearInterval(id);
      };
    }

    const channelName = `user-${userId}`;
    const channel = pusher.subscribe(channelName);

    const onNewMessage = () => {
      if (!mounted) return;
      fetchUnread(); // actualiza badge
      router.refresh(); // refresca RSC (inbox/nav si leen del server)
    };

    channel.bind("message:new", onNewMessage);

    return () => {
      mounted = false;
      channel.unbind("message:new", onNewMessage);
      pusher.unsubscribe(channelName);

      // ⚠️ No desconectes el singleton aquí: puede haber otros componentes usando Pusher.
      // pusher.disconnect();
    };
  }, [userId, router]);

  return (
    <Link href="/chat" className="relative inline-flex items-center gap-2">
      <span>💬 Chat</span>
      {total > 0 && (
        <span className="min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs inline-flex items-center justify-center">
          {total > 99 ? "99+" : total}
        </span>
      )}
    </Link>
  );
}
