import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendMail } from "@/app/lib/mailer";

export const runtime = "nodejs";

/* =========================
   HELPERS
========================= */
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
    <p style="margin:0; font-size:13px; color:#555;">
      Pozdrawiamy,<br/>
      <strong>Zespół MojaSzafa</strong>
    </p>
    <p style="margin-top:6px; font-size:11px; color:#888;">
      Ta wiadomość została wysłana automatycznie — prosimy na nią nie odpowiadać.
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
  const s = fmt(p.startDate);
  const e = fmt(p.endDate);

  const moneyPLN = (v: number) =>
    `${new Intl.NumberFormat("pl-PL").format(v)} zł`;

  return `
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#111; line-height:1.5;">

  <p>Cześć ${p.renterName},</p>

  <p>
    Twoja rezerwacja została <strong>automatycznie anulowana</strong>,
    ponieważ płatność nie została ukończona w ciągu 24 godzin od zatwierdzenia.
  </p>

  <div style="margin:16px 0; padding:16px; border:1px solid #e5e7eb; border-radius:8px; background:#fafafa;">
    <p style="margin:0 0 8px 0; font-size:16px; font-weight:600;">
      ${p.listingTitle}
    </p>

    <p style="margin:4px 0;">
      <strong>Numer rezerwacji:</strong> #${p.bookingNumber}
    </p>

    <p style="margin:4px 0;">
      <strong>Daty:</strong> ${s} → ${e}
    </p>

    <p style="margin:4px 0;">
      <strong>Kwota:</strong> ${moneyPLN(p.total)}
    </p>
  </div>

  <div style="margin-top:18px; padding:14px; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; color:#991b1b;">
    <strong>Ważne:</strong><br/>
    Rezerwacja została anulowana automatycznie z powodu braku płatności.
  </div>

  <p style="margin-top:16px;">
    Jeśli nadal chcesz wynająć ten przedmiot, możesz złożyć nową rezerwację.
  </p>

  <p>
    <a href="${p.baseUrl}/listing/${p.listingId}" 
       style="display:inline-block; margin-top:12px; padding:12px 18px; 
              background:#111827; color:white; text-decoration:none; 
              border-radius:6px; font-weight:600;">
      Zobacz ogłoszenie
    </a>
  </p>

  ${emailSignature()}

</div>
`;
}

/* =========================
   CRON
========================= */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();

  console.log("CRON START cancel-unpaid-bookings", now.toISOString());

  const bookings = await prisma.booking.findMany({
    where: {
      status: "AWAITING_PAYMENT",
      paymentStatus: "PENDING",
      paymentDueAt: { lt: now },
    },
    include: {
      renter: true,
      listing: true,
    },
  });

  console.log("Bookings to cancel:", bookings.length);

  if (bookings.length === 0) {
    return NextResponse.json({
      ok: true,
      cancelled: 0,
      ranAt: now.toISOString(),
    });
  }

  await prisma.booking.updateMany({
    where: {
      id: { in: bookings.map((b) => b.id) },
    },
    data: {
      status: "CANCELLED",
      paymentStatus: "CANCELLED",
      cancelledAt: now,
      paymentDueAt: null,
    },
  });

  const baseUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  for (const b of bookings) {
    if (!b.renter?.email) continue;

    const start = new Date(b.startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(b.endDate);
    end.setHours(0, 0, 0, 0);

    const days =
      Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

    const pricePerDay = b.listing.pricePerDay ?? 0;
    const deposit = b.listing.fianza ?? 0;
    const total = pricePerDay * days + deposit;

    try {
      await sendMail({
        to: b.renter.email,
        subject: `Rezerwacja anulowana #${b.bookingNumber}: ${b.listing.title ?? "Ogłoszenie"}`,
        html: bookingAutoCancelledHtml({
          renterName: b.renter.name ?? "Użytkowniku",
          listingTitle: b.listing.title ?? "Ogłoszenie",
          bookingNumber: b.bookingNumber,
          startDate: b.startDate,
          endDate: b.endDate,
          total,
          baseUrl,
          listingId: b.listing.id,
        }),
      });
    } catch (err) {
      console.error("Auto-cancel email error:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    cancelled: bookings.length,
    ranAt: now.toISOString(),
  });
}