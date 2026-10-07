import { calendarDayOffset, rentalCalendarDate, warsawCalendarDate } from "@/app/lib/rentalCalendarDate";

export function lateDeliverySuggestion(start: Date, end: Date, receivedDate: string, rentCents: number) {
  const totalDays = calendarDayOffset(rentalCalendarDate(start), rentalCalendarDate(end)) + 1;
  const delayDays = calendarDayOffset(rentalCalendarDate(start), receivedDate);
  if (!Number.isInteger(totalDays) || totalDays <= 0 || !Number.isInteger(delayDays) || delayDays <= 0 ||
      !Number.isSafeInteger(rentCents) || rentCents < 0) throw new Error("Podaj datę odbioru późniejszą niż pierwszy dzień rezerwacji.");
  return { totalDays, delayDays, refundCents: Math.round(rentCents * Math.min(delayDays, totalDays) / totalDays) };
}

export function validateLateDeliveryDate(value: string, start: Date, end: Date, rentCents: number, now = new Date()) {
  const parsed = new Date(value + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || rentalCalendarDate(parsed) !== value)
    throw new Error("Podaj prawidłową datę odbioru przedmiotu.");
  if (value > warsawCalendarDate(now)) throw new Error("Podaj datę odbioru, która nie jest w przyszłości.");
  return { date: parsed, ...lateDeliverySuggestion(start, end, value, rentCents) };
}
