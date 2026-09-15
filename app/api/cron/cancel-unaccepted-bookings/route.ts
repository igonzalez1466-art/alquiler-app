import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendMail } from "@/app/lib/mailer";
import {
  APPROVAL_WINDOW_MS,
  expirePendingBooking,
} from "@/app/lib/approvalExpiry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function escapeHtml(value: string) {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return value.replace(
    /[&<>"']/g,
    (character) => replacements[character]
  );
}

function getBaseUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function cancellationEmail(input: {
  recipientName: string;
  isOwner: boolean;
  bookingNumber: number;
  listingTitle: string;
  startDate: Date;
  endDate: Date;
  listingUrl: string;
}) {
  const explanation = input.isOwner
    ? "Nie zaakceptowałeś prośby o rezerwację w ciągu 12 godzin od jej utworzenia. Rezerwacja została anulowana."
    : "Właściciel nie zaakceptował Twojej prośby o rezerwację w ciągu 12 godzin od jej utworzenia. Rezerwacja została anulowana.";

  const nextStep = input.isOwner
    ? "Ta rezerwacja nie blokuje już terminów w kalendarzu."
    : "Możesz złożyć nową prośbę o rezerwację lub wybrać inny przedmiot.";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5;">
      <p>Cześć ${escapeHtml(input.recipientName)},</p>

      <p>${explanation}</p>

      <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;">
        <p style="margin:0 0 8px;font-size:16px;font-weight:600;">
          ${escapeHtml(input.listingTitle)}
        </p>

        <p>
          <strong>Numer rezerwacji:</strong>
          #${input.bookingNumber}
        </p>

        <p>
          <strong>Daty:</strong>
          ${formatDate(input.startDate)}
          →
          ${formatDate(input.endDate)}
        </p>

        <p>
          <strong>Powód anulowania:</strong>
          brak akceptacji właściciela w ciągu 12 godzin.
        </p>
      </div>

      <p>${nextStep}</p>

      <p>
        <a
          href="${escapeHtml(input.listingUrl)}"
          style="display:inline-block;padding:12px 18px;background:#111827;color:white;text-decoration:none;border-radius:6px;"
        >
          Zobacz ogłoszenie
        </a>
      </p>

      <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />

      <p style="font-size:13px;color:#555;">
        Pozdrawiamy,<br/>
        <strong>Zespół MojaSzafa</strong>
      </p>

      <p style="font-size:11px;color:#888;">
        Ta wiadomość została wysłana automatycznie —
        prosimy na nią nie odpowiadać.
      </p>
    </div>
  `;
}

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

  // En Preview, las pruebas afectan a una sola reserva.
  if (
    process.env.VERCEL_ENV === "preview" &&
    target === null
  ) {
    return NextResponse.json(
      {
        error: "Provide bookingNumber for a Preview test",
      },
      { status: 400 }
    );
  }

  const now = new Date();

  const cutoff = new Date(
    now.getTime() - APPROVAL_WINDOW_MS
  );

  const bookings = await prisma.booking.findMany({
    where: {
      ...(target !== null
        ? { bookingNumber: Number(target) }
        : {}),
      status: "PENDING",
      createdAt: {
        lte: cutoff,
      },
      paymentStatus: "PENDING",
      paidAt: null,
      paymentRef: null,
      cancelledAt: null,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 10,
    select: {
      id: true,
      bookingNumber: true,
      ownerId: true,
      startDate: true,
      endDate: true,
      listingId: true,
      listing: {
        select: {
          title: true,
        },
      },
      renter: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  let cancelled = 0;
  let skipped = 0;
  let errors = 0;
  let emailsSent = 0;
  let emailErrors = 0;

  const baseUrl = getBaseUrl();

  for (const booking of bookings) {
    let changed = false;

    try {
      changed = await expirePendingBooking(booking.id);
    } catch (error) {
      errors++;

      console.error(
        "Unaccepted booking cancellation failed",
        {
          bookingId: booking.id,
          error,
        }
      );

      continue;
    }

    // Puede haber sido aceptada o rechazada después
    // de la consulta inicial. En ese caso, no la modifica.
    if (!changed) {
      skipped++;
      continue;
    }

    cancelled++;

    const title =
      booking.listing.title ?? "Ogłoszenie";

    const listingUrl =
      `${baseUrl}/listing/${booking.listingId}`;

    async function notifyRecipient(
      email: string,
      name: string,
      isOwner: boolean
    ) {
      try {
        await sendMail({
          to: email,
          subject:
            `Rezerwacja anulowana #${booking.bookingNumber}: ${title}`,
          html: cancellationEmail({
            recipientName: name,
            isOwner,
            bookingNumber: booking.bookingNumber,
            listingTitle: title,
            startDate: booking.startDate,
            endDate: booking.endDate,
            listingUrl,
          }),
        });

        emailsSent++;
      } catch (error) {
        emailErrors++;

        console.error(
          "Unaccepted booking cancellation email failed",
          {
            bookingId: booking.id,
            recipientRole: isOwner ? "owner" : "renter",
            error,
          }
        );
      }
    }

    const renterEmail = booking.renter?.email?.trim();

    if (renterEmail) {
      await notifyRecipient(
        renterEmail,
        booking.renter?.name ?? "Użytkowniku",
        false
      );
    }

    // Utiliza el propietario guardado en la reserva.
    try {
      const owner = await prisma.user.findUnique({
        where: {
          id: booking.ownerId,
        },
        select: {
          name: true,
          email: true,
        },
      });

      const ownerEmail = owner?.email?.trim();

      if (ownerEmail) {
        await notifyRecipient(
          ownerEmail,
          owner?.name ?? "Użytkowniku",
          true
        );
      }
    } catch (error) {
      emailErrors++;

      console.error(
        "Cannot load owner for cancellation email",
        {
          bookingId: booking.id,
          error,
        }
      );
    }
  }

  return NextResponse.json({
    ok: errors === 0 && emailErrors === 0,
    checked: bookings.length,
    cancelled,
    skipped,
    errors,
    emailsSent,
    emailErrors,
    ranAt: now.toISOString(),
  });
}