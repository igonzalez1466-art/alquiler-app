import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ total: 0 }, { headers: { "Cache-Control": "no-store" } });
  }

  const convs = await prisma.conversation.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    select: {
      id: true, buyerId: true, sellerId: true,
      buyerLastReadAt: true, sellerLastReadAt: true,
    },
  });

  const counts = await Promise.all(
    convs.map((c) => {
      const iAmBuyer = userId === c.buyerId;
      const myLastRead = iAmBuyer ? c.buyerLastReadAt : c.sellerLastReadAt;
      const otherId = iAmBuyer ? c.sellerId : c.buyerId;
      return prisma.message.count({
        where: {
          conversationId: c.id,
          senderId: otherId,
          ...(myLastRead ? { createdAt: { gt: myLastRead } } : {}),
        },
      });
    })
  );

  const total = counts.reduce((a, b) => a + b, 0);
  return NextResponse.json({ total }, { headers: { "Cache-Control": "no-store" } });
}
