// app/lib/pusher-client.ts
"use client";

import Pusher from "pusher-js";

let client: Pusher | null = null;

/**
 * Devuelve un cliente Pusher singleton para el navegador.
 */
export function getPusherClient() {
  if (!client) {
    client = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
  }
  return client;
}
