import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/app/lib/prisma";
import { sendMail } from "@/app/lib/mailer";
import { DepositStatus } from "@prisma/client";

export const runtime = "nodejs";

// ============================================================
// HELPERS
// ============================================================

function fmt(d: Date | string) {
  const dt = new Date(d);

  return `${dt.getFullYear()}-${String(
    dt.getMonth() + 1
  ).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
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

function moneyPLNFromCents(v: number) {
  return `${new Intl.NumberFormat("pl-PL").format(v / 100)} zł`;
}

// ============================================================
// WEBHOOK
// ============================================================

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error("Missing Stripe env vars");

    return new NextResponse(
      "Missing Stripe env vars",
      { status: 500 }
    );
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: "2025-09-30.clover",
  });

  const sig =
    req.headers.get("stripe-signature");

  if (!sig) {
    return new NextResponse(
      "Missing stripe-signature",
      { status: 400 }
    );
  }

  const rawBody =
    await req.text();

  let event: Stripe.Event;

  try {
    event =
      stripe.webhooks.constructEvent(
        rawBody,
        sig,
        webhookSecret
      );
  } catch (err) {
    console.error(
      "Webhook signature failed",
      err
    );

    return new NextResponse(
      "Invalid signature",
      { status: 400 }
    );
  }

  // ==========================================================
  // PROCESS EVENT
  // ==========================================================

  try {
    switch (event.type) {

      // ======================================================
      // PAYMENT SUCCESS
      // ======================================================

      case "payment_intent.succeeded": {
        const pi =
          event.data.object as Stripe.PaymentIntent;

        const bookingId =
          pi.metadata?.bookingId;

        const kind =
          pi.metadata?.kind;

        // Ignoramos PaymentIntents que no pertenecen
        // al pago de una reserva.
        if (
          !bookingId ||
          kind !== "booking_payment"
        ) {
          console.log(
            "Ignoring PI",
            pi.id,
            bookingId,
            kind
          );

          break;
        }

        // ====================================================
        // AMOUNTS FROM STRIPE METADATA
        // ====================================================

        const rentAmountCents =
          Number(
            pi.metadata?.rentAmountCents ??
              "0"
          );

        const depositAmountCents =
          Number(
            pi.metadata?.depositAmountCents ??
              "0"
          );

        // ====================================================
        // GET BOOKING
        // ====================================================

        const existingBooking =
          await prisma.booking.findUnique({
            where: {
              id: bookingId,
            },

            include: {
              renter: true,

              listing: {
                include: {
                  user: true,
                },
              },
            },
          });

        if (!existingBooking) {
          console.error(
            "Booking not found:",
            bookingId
          );

          break;
        }

        // Evita enviar el email otra vez si Stripe
        // reintenta el webhook.
        const wasAlreadyPaid =
          existingBooking.paymentStatus ===
          "PAID";

        // ====================================================
        // UPDATE BOOKING
        // ====================================================

        await prisma.booking.update({
          where: {
            id: bookingId,
          },

          data: {
            status: "CONFIRMED",

            paymentStatus: "PAID",

            paymentMethod: "CARD",

            paymentRef: pi.id,

            paidAt: new Date(),

            paymentDueAt: null,

            cancelledAt: null,

            // Importe del alquiler
            amountCents:
              rentAmountCents,

            // Kaucja
            depositCents:
              depositAmountCents,

            depositStatus:
              depositAmountCents > 0
                ? DepositStatus.PAID
                : DepositStatus.NONE,

            depositPaidAt:
              depositAmountCents > 0
                ? new Date()
                : null,

            depositPaymentIntentId:
              depositAmountCents > 0
                ? pi.id
                : null,
          },
        });

        console.log(
          "✅ Booking PAID:",
          bookingId
        );

        // ====================================================
        // OWNER EMAIL
        // ====================================================

        if (!wasAlreadyPaid) {
          const owner =
            existingBooking.listing.user;

          const ownerEmail =
            owner?.email;

          if (!ownerEmail) {
            console.log(
              "Owner has no email, skipping mail",
              bookingId
            );

            break;
          }

          const renter =
            existingBooking.renter;

          const listing =
            existingBooking.listing;

          const ref =
            `#${existingBooking.bookingNumber}`;

          const s =
            fmt(
              existingBooking.startDate
            );

          const e =
            fmt(
              existingBooking.endDate
            );

          const title =
            listing.title ??
            "Przedmiot";

          // ==================================================
          // TOTAL PAGADO POR EL RENTER
          // ==================================================

          const totalCents =
            rentAmountCents +
            depositAmountCents;

          // ==================================================
          // COMISIÓN MOJASZAFA
          // ==================================================
          //
          // TEMPORAL:
          // Comisión fija del 15%.
          //
          // IMPORTANTE:
          // Se calcula solamente sobre el alquiler.
          // La kaucja no tiene comisión.
          //
          // Más adelante estos valores deberán guardarse
          // como snapshot en Booking.
          //
          // ==================================================

          const platformFeePercent =
            15;

          const platformFeeCents =
            Math.round(
              rentAmountCents *
                (
                  platformFeePercent /
                  100
                )
            );

          const ownerEarningsCents =
            rentAmountCents -
            platformFeeCents;

          // ==================================================
          // DIRECT BOOKING URL
          // ==================================================

          const baseUrl =
            (
              process.env.APP_URL ||
              "http://localhost:3000"
            ).replace(/\/$/, "");

          const bookingUrl =
            `${baseUrl}/bookings/${existingBooking.id}`;

          // ==================================================
          // SEND OWNER EMAIL
          // ==================================================

          await sendMail({
            to: ownerEmail,

            subject:
              `Płatność potwierdzona ${ref}: ${title}`,

            html: `
<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#111; line-height:1.5;">

  <p>
    Cześć ${owner.name ?? ""},
  </p>

  <p>
    Płatność za rezerwację została
    <strong>pomyślnie potwierdzona</strong>.
  </p>

  <div
    style="
      margin:16px 0;
      padding:16px;
      border:1px solid #e5e7eb;
      border-radius:8px;
      background:#fafafa;
    "
  >

    <!-- TITLE -->

    <p
      style="
        margin:0 0 8px 0;
        font-size:16px;
        font-weight:600;
      "
    >
      ${title}
    </p>

    <!-- BOOKING NUMBER -->

    <p style="margin:4px 0;">
      <strong>Numer rezerwacji:</strong>
      ${ref}
    </p>

    <!-- RENTER -->

    <p style="margin:4px 0;">
      <strong>Klient:</strong>
      ${renter?.name ?? "Użytkownik"}
    </p>

    <!-- DATES -->

    <p style="margin:4px 0;">
      <strong>Daty:</strong>
      ${s} → ${e}
    </p>

    <!-- ============================================
         RENT
    ============================================= -->

    <p
      style="
        margin:12px 0 4px 0;
        padding-top:10px;
        border-top:1px solid #e5e7eb;
      "
    >
      <strong>Koszt najmu:</strong>

      ${moneyPLNFromCents(
        rentAmountCents
      )}
    </p>

    <!-- ============================================
         MOJASZAFA COMMISSION
    ============================================= -->

    <p style="margin:4px 0;">

      <strong>
        Prowizja MojaSzafa
        (${platformFeePercent}%):
      </strong>

      −${moneyPLNFromCents(
        platformFeeCents
      )}

    </p>

    <!-- ============================================
         OWNER EARNINGS
    ============================================= -->

    <p
      style="
        margin:8px 0 4px 0;
        padding-top:8px;
        border-top:1px solid #e5e7eb;
      "
    >

      <strong>
        Twoje wynagrodzenie:
      </strong>

      <span
        style="
          font-weight:700;
          color:#047857;
          font-size:16px;
        "
      >
        ${moneyPLNFromCents(
          ownerEarningsCents
        )}
      </span>

    </p>

    <!-- ============================================
         DEPOSIT
    ============================================= -->

    ${
      depositAmountCents > 0
        ? `
          <p
            style="
              margin:10px 0 4px 0;
            "
          >
            <strong>
              Kaucja (zwrotna):
            </strong>

            ${moneyPLNFromCents(
              depositAmountCents
            )}
          </p>
        `
        : ""
    }

    <!-- ============================================
         COMMISSION EXPLANATION
    ============================================= -->

    <p
      style="
        margin:8px 0 4px 0;
        font-size:12px;
        color:#6b7280;
      "
    >
      Prowizja MojaSzafa jest naliczana
      wyłącznie od kosztu najmu.
      Kaucja nie jest objęta prowizją.
    </p>

    <!-- ============================================
         TOTAL PAID BY RENTER
    ============================================= -->

    <p
      style="
        margin:12px 0 4px 0;
        padding-top:10px;
        border-top:1px solid #e5e7eb;
      "
    >
      <strong>
        Łącznie zapłacone przez klienta:
      </strong>

      ${moneyPLNFromCents(
        totalCents
      )}
    </p>

  </div>

  <!-- ==============================================
       NEXT STEP
  =============================================== -->

  <p>
    Możesz teraz przygotować wysyłkę przedmiotu
    lub skontaktować się z klientem,
    aby ustalić sposób przekazania.
  </p>

  <!-- ==============================================
       SUCCESS BOX
  =============================================== -->

  <div
    style="
      margin-top:18px;
      padding:14px;
      background:#dcfce7;
      border:1px solid #86efac;
      border-radius:8px;
      color:#166534;
    "
  >

    <strong>
      Gotowe do realizacji:
    </strong>
    <br/>

    Płatność została zaksięgowana.
    Możesz przejść do realizacji zamówienia.

  </div>

  <!-- ==============================================
       BOOKING BUTTON
  =============================================== -->

  <p>

    <a
      href="${bookingUrl}"
      style="
        display:inline-block;
        margin-top:14px;
        padding:10px 16px;
        background:#111827;
        color:white;
        text-decoration:none;
        border-radius:6px;
        font-weight:500;
      "
    >
      Zobacz szczegóły rezerwacji
    </a>

  </p>

  ${emailSignature()}

</div>
            `,
          });
        }

        break;
      }

      // ======================================================
      // DEPOSIT REFUND
      // ======================================================

      case "charge.refunded": {
        const charge =
          event.data.object as Stripe.Charge;

        const paymentIntentId =
          typeof charge.payment_intent ===
          "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;

        if (!paymentIntentId) {
          break;
        }

        const booking =
          await prisma.booking.findFirst({
            where: {
              depositPaymentIntentId:
                paymentIntentId,
            },

            select: {
              id: true,
              depositCents: true,
              depositStatus: true,
              depositRefundedAt: true,
              depositReleaseAt: true,
            },
          });

        if (
          !booking ||
          !booking.depositCents
        ) {
          break;
        }

        // ====================================================
        // ALLOWED DEPOSIT STATUSES
        // ====================================================

        const allowedStatuses:
          DepositStatus[] = [
          DepositStatus.PAID,
          DepositStatus.REFUND_PENDING,
          DepositStatus.PARTIALLY_REFUNDED,
          DepositStatus.REFUNDED,
        ];

        if (
          !allowedStatuses.includes(
            booking.depositStatus
          )
        ) {
          console.log(
            "Ignoring deposit webhook due to status",
            booking.id,
            booking.depositStatus
          );

          break;
        }

        // ====================================================
        // REFUND AMOUNTS
        // ====================================================

        const refundedCents =
          charge.amount_refunded;

        const retainedCents =
          Math.max(
            booking.depositCents -
              refundedCents,
            0
          );

        let depositStatus:
          DepositStatus =
          DepositStatus.PAID;

        if (
          refundedCents >=
          booking.depositCents
        ) {
          depositStatus =
            DepositStatus.REFUNDED;
        } else if (
          refundedCents > 0
        ) {
          depositStatus =
            DepositStatus.PARTIALLY_REFUNDED;
        }

        // ====================================================
        // UPDATE DEPOSIT
        // ====================================================

        await prisma.booking.update({
          where: {
            id: booking.id,
          },

          data: {
            depositStatus,

            depositRefundedCents:
              refundedCents,

            depositRetainedCents:
              retainedCents,

            depositRefundedAt:
              refundedCents > 0
                ? new Date()
                : booking.depositRefundedAt,

            depositReleaseAt:
              refundedCents > 0
                ? new Date()
                : booking.depositReleaseAt,

            depositLastError: null,
          },
        });

        console.log(
          "↩️ Deposit refund updated:",
          booking.id,
          {
            refundedCents,
            retainedCents,
            depositStatus,
          }
        );

        break;
      }

      // ======================================================
      // OTHER STRIPE EVENTS
      // ======================================================

      default:
        break;
    }

    return NextResponse.json({
      received: true,
    });
  } catch (err) {
    console.error(
      "Webhook handler error",
      err
    );

    return new NextResponse(
      "Webhook handler failed",
      { status: 500 }
    );
  }
}