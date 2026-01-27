// app/lib/pusher-client.ts
"use client";

import Pusher from "pusher-js";

let client: Pusher | null = null;

export function getPusherClient() {
  if (client) return client;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  // ⛔️ En Preview / local puede no existir → no romper la app
  if (!key || !cluster) {
    console.warn("[PUSHER] disabled (missing NEXT_PUBLIC_PUSHER_KEY/CLUSTER)");
    return null;
  }

  client = new Pusher(key, { cluster });
  return client;
}
