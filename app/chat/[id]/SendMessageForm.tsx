"use client";

import { useRef, useTransition } from "react";
import { sendMessageAction } from "./actions"; // misma carpeta

export default function SendMessageForm({ conversationId }: { conversationId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          await sendMessageAction(conversationId, formData);
          formRef.current?.reset();
        })
      }
      className="flex gap-2"
      autoComplete="off"
    >
      <input
        type="text"
        name="text"
        placeholder="Escribe un mensaje…"
        className="flex-1 border rounded px-3 py-2"
        disabled={pending}
        required
      />
      <button
        type="submit"
        className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Enviando…" : "Enviar"}
      </button>
    </form>
  );
}
