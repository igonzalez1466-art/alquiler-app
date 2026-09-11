import { NextResponse } from "next/server";
import { processReviewInvitations } from "@/app/lib/reviewInvitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ processed: await processReviewInvitations() });
  } catch {
    return NextResponse.json({ error: "Review invitation job failed" }, { status: 500 });
  }
}
