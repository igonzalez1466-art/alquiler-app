import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const userId = (await getSession())?.user?.id;
  if (!userId) return new Response("Not found", { status: 404 });
  const { id, photoId } = await params;
  const photo = await prisma.bookingEvidencePhoto.findFirst({
    where: { id: photoId, bookingId: id, booking: { OR: [{ ownerId: userId }, { renterId: userId }] } },
    select: { data: true, mimeType: true },
  });
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(Uint8Array.from(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
