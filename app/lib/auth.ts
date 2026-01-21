// app/lib/auth.ts
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authConfig } from "@/auth.config";

export async function getSession(): Promise<Session | null> {
  return getServerSession(authConfig);
}
