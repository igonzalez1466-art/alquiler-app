import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth.config";
import { prisma } from "@/app/lib/prisma";
import { approveBookingAction } from "@/app/bookings/actions";

export const runtime = "nodejs";

export async function PATCH(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const session = await getServerSession(authConfig);

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", {
      status: 401,
    });
  }

  const { id } = await context.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!booking || booking.ownerId !== session.user.id) {
    return new NextResponse("Forbidden", {
      status: 403,
    });
  }

  // Si ya fue procesada, devuelve su estado actual
  // sin volver a aceptar ni modificar el vencimiento.
  if (booking.status !== "PENDING") {
    return NextResponse.json({
      bookingId: id,
      status: booking.status,
      paymentDueAt: booking.paymentDueAt,
    });
  }

  try {
    await approveBookingAction(id);
  } catch {
    return new NextResponse(
      "Nie udało się zakończyć akceptacji. Odśwież rezerwację, aby sprawdzić jej stan.",
      { status: 409 }
    );
  }

  const result = await prisma.booking.findUnique({
    where: { id },
    select: {
      status: true,
      paymentDueAt: true,
    },
  });

  return NextResponse.json({
    bookingId: id,
    ...result,
  });
}