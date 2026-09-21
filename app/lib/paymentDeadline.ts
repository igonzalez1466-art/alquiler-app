type PaymentDeadline = {
  status: string;
  paymentStatus: string;
  paymentDueAt: Date | null;
};

// A display state only. Cancellation still requires the existing payment checks.
export function isPaymentDeadlineExpired(booking: PaymentDeadline, now: Date = new Date()) {
  return booking.status === "AWAITING_PAYMENT" &&
    booking.paymentStatus === "PENDING" &&
    booking.paymentDueAt !== null &&
    booking.paymentDueAt.getTime() <= now.getTime();
}
