/** Re-enable only after the deposit product and legal flow are restored. */
export const DEPOSITS_ENABLED = false;

/** Existing paid reservations keep their deposit history and settlement flow. */
export function hasLegacyDeposit(booking: { depositCents?: number | null }) {
  return (booking.depositCents ?? 0) > 0;
}
