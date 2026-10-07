"use client";
import { useEffect } from "react";
import { markChatAsRead } from "./actions";

export default function ChatReadReceipt({ conversationId, readThrough }: { conversationId: string; readThrough: string | null }) {
  useEffect(() => {
    let active = true;
    // Mark only the messages rendered on this page, after navigation (never during prefetch).
    if (readThrough) void markChatAsRead(conversationId, readThrough).then(saved => {
      if (active && saved) window.dispatchEvent(new Event("mojaszafa:chat-read"));
    }).catch(() => { /* A failed receipt must not hide unread messages. */ });
    return () => { active = false; };
  }, [conversationId, readThrough]);
  return null;
}
