const DAY_MS = 86_400_000;
export function shiftBookingDay(day: string, offset: number): string {
  return new Date(Date.parse(day + "T00:00:00Z") + offset * DAY_MS).toISOString().slice(0, 10);
}
export type BookingDateRange = { start: string; end: string };
export function shippingRange(range: BookingDateRange): BookingDateRange {
  return { start: shiftBookingDay(range.start, -1), end: shiftBookingDay(range.end, 1) };
}
export function shippingRangesOverlap(a: BookingDateRange, b: BookingDateRange): boolean {
  const left = shippingRange(a), right = shippingRange(b);
  return left.start <= right.end && left.end >= right.start;
}
// Both reservations reserve their own day before and day after the rental.
export function shippingOverlapWhere(start: Date, end: Date) {
  return {
    startDate: { lte: new Date(end.getTime() + 2 * DAY_MS) },
    endDate: { gte: new Date(start.getTime() - 2 * DAY_MS) },
  };
}
