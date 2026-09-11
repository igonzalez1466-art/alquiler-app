import { expireUnpaidBooking } from "@/app/lib/paymentExpiry";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendMail } from "@/app/lib/mailer";

export const runtime = "nodejs";

function fmt(d: Date | string) {
  const dt = new Date(d);

  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(dt.getDate()).padStart(2, "0")}`;
}

function emailSignature() {
  return `
    <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />

    <p style="margin:0;font-size:13px;color:#555;">
      Pozdrawiamy,<br/>
      <strong>Zespół MojaSzafa</strong>
    </p>

    <p style="margin-top:6px;font-size:11px;color:#888;">
      Ta wiadomość została wysłana automatycznie —
      prosimy na nią nie odpowiadać.
    </p>
  `;
}

function bookingAutoCancelledHtml(p: {
  renterName: string;
  listingTitle: string;
  bookingNumber: number;
  startDate: Date;
  endDate: Date;
  total: number;
  baseUrl: string;
  listingId: string;
}) {
  const start = fmt(p.startDate);
  const end = fmt(p.endDate);

  const moneyPLN = (value: number) =>
    `${new Intl.NumberFormat("pl-PL").format(value)} zł`;

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5;">
      <p>Cześć ${p.renterName},</p>

      <p>
        Twoja rezerwacja została
        <strong>automatycznie anulowana</strong>,
        ponieważ płatność nie została ukończona
        w ciągu 2 godzin od zatwierdzenia.
      </p>

      <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;">
        <p style="margin:0 0 8px;font-size:16px;font-weight:600;">
          ${p.listingTitle}
        </p>

        <p style="margin:4px 0;">
          <strong>Numer rezerwacji:</strong>
          #${p.bookingNumber}
        </p>

        <p style="margin:4px 0;">
          <strong>Daty:</strong> ${start} → ${end}
        </p>

        <p style="margin:4px 0;">
          <strong>Kwota:</strong> ${moneyPLN(p.total)}
        </p>
      </div>

      <p>
        Jeśli nadal chcesz wynająć ten przedmiot,
        możesz złożyć nową rezerwację.
      </p>

      <p>
        <a
          href="${p.baseUrl}/listing/${p.listingId}"
          style="display:inline-block;margin-top:12px;padding:12px 18px;background:#111827;color:white;text-decoration:none;border-radius:6px;font-weight:600;"
        >
          Zobacz ogłoszenie
        </a>
      </p>

      ${emailSignature()}
    </div>
  `;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const target = new URL(req.url).searchParams.get("bookingNumber");

  if (
    target !== null &&
    (
      !/^\d+$/.test(target) ||
      !Number.isSafeInteger(Number(target)) ||
      Number(target) < 1
    )
  ) {
    return NextResponse.json(
      { error: "Invalid bookingNumber" },
      { status: 400 }
    );
  }

  // En Preview solo permite comprobar una reserva concreta.
  if (process.env.VERCEL_ENV === "preview" && target === null) {
    return NextResponse.json(
      { error: "Provide bookingNumber for a Preview test" },
      { status: 400 }
    );
  }

  const now = new Date();

  console.log(
    "CRON START cancel-unpaid-bookings",
    now.toISOString()
  );

  const bookings = await prisma.booking.findMany({
    where: {
      ...(target !== null
        ? { bookingNumber: Number(target) }
        : {}),
      status: "AWAITING_PAYMENT",
      paymentStatus: "PENDING",
      paymentDueAt: {
        lte: now,
      },
      paidAt: null,
    },
    take: 50,
    orderBy: {
      paymentDueAt: "asc",
    },
    include: {
      renter: true,
      listing: true,
    },
  });

  if (bookings.length === 0) {
    return NextResponse.json({
      ok: true,
      cancelled: 0,
      ranAt: now.toISOString(),
    });
  }

  const cancelledIds = new Set<string>();

  for (const booking of bookings) {
    try {
      const cancelled = await expireUnpaidBooking(booking.id);

      if (cancelled) {
        cancelledIds.add(booking.id);
      }
    } catch {
      // Si Stripe falla, conserva la reserva para reintentar.
      console.error(
        "Expiry deferred; payment state must be verified",
        { bookingId: booking.id }
      );
    }
  }

  const baseUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  for (const booking of bookings) {
    if (
      !cancelledIds.has(booking.id) ||
      !booking.renter?.email
    ) {
      continue;
    }

    const start = new Date(booking.startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(booking.endDate);
    end.setHours(0, 0, 0, 0);

    const days =
      Math.floor(
        (end.getTime() - start.getTime()) / 86400000
      ) + 1;

    const pricePerDay = booking.listing.pricePerDay ?? 0;
    const deposit = booking.listing.fianza ?? 0;

    const rentCents =
      booking.rentAmountCents ??
      booking.amountCents ??
      pricePerDay * days * 100;

    const depositCents =
      booking.depositCents ?? deposit * 100;

    const total = (rentCents + depositCents) / 100;

    try {
      await sendMail({
        to: booking.renter.email,
        subject:
          `Rezerwacja anulowana #${booking.bookingNumber}: ` +
          (booking.listing.title ?? "Ogłoszenie"),
        html: bookingAutoCancelledHtml({
          renterName:
            booking.renter.name ?? "Użytkowniku",
          listingTitle:
            booking.listing.title ?? "Ogłoszenie",
          bookingNumber: booking.bookingNumber,
          startDate: booking.startDate,
          endDate: booking.endDate,
          total,
          baseUrl,
          listingId: booking.listing.id,
        }),
      });
    } catch (error) {
      console.error("Auto-cancel email error:", error);
    }
  }

  return NextResponse.json({
    ok: true,
    cancelled: cancelledIds.size,
    ranAt: now.toISOString(),
  });
}