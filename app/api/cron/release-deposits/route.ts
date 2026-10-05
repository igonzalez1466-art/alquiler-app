import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import {
  releaseDepositAutomatically,
} from "@/app/lib/automaticDepositRelease";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", {
      status: 401,
    });
  }

  const target = new URL(req.url).searchParams.get(
    "bookingNumber"
  );

  if (
    target === null ||
    !/^\d+$/.test(target) ||
    !Number.isSafeInteger(Number(target)) ||
    Number(target) < 1
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Provide a valid bookingNumber",
      },
      { status: 400 }
    );
  }

  const bookingNumber = Number(target);

  const booking = await prisma.booking.findUnique({
    where: {
      bookingNumber,
    },
    select: {
      id: true,
      bookingNumber: true,
    },
  });

  if (!booking) {
    return NextResponse.json(
      {
        ok: false,
        error: "Booking not found",
      },
      { status: 404 }
    );
  }

  try {
    const result = await releaseDepositAutomatically(
      booking.id
    );

    const current = await prisma.booking.findUniqueOrThrow({
      where: {
        id: booking.id,
      },
      select: {
        depositStatus: true,
        depositRefundId: true,
        settlementCompletedAt: true,
      },
    });

    revalidatePath(`/bookings/${booking.id}`);
    revalidatePath("/bookings");

    return NextResponse.json({
      ok: true,
      bookingNumber,
      outcome: result.outcome,
      completedThisRun: result.completed,
      depositStatus: current.depositStatus,
      refundId: current.depositRefundId,
      settlementCompletedAt: current.settlementCompletedAt,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nie udało się zakończyć rozliczenia.";

    console.error(
      "Automatic deposit release failed",
      {
        bookingId: booking.id,
        bookingNumber,
        error,
      }
    );

    // Conserva la decisión y las operaciones guardadas.
    // No reinicia la liquidación ni cambia sus importes.
    return NextResponse.json(
      {
        ok: false,
        bookingNumber,
        error: message,
        ranAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}