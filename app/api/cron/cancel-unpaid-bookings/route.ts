import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();

  const result = await prisma.booking.updateMany({
    where: {
      status: "AWAITING_PAYMENT",
      paymentStatus: "PENDING",
      paymentDueAt: {
        lt: now,
      },
    },
    data: {
      status: "CANCELLED",
      paymentStatus: "CANCELLED",
      cancelledAt: now,
    },
  });

  return NextResponse.json({
    ok: true,
    cancelled: result.count,
    ranAt: now.toISOString(),
  });
}