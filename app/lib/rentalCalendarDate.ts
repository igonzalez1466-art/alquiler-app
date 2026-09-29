// Booking dates are selected as calendar days and stored at 00:00 UTC.
// That UTC instant is not an agreed handover time in Poland.
export function rentalCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function warsawCalendarDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find(value => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function calendarDayOffset(startDate: string, eventDate: string): number {
  return (Date.parse(`${eventDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000;
}

export function formatCalendarDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("pl-PL", { timeZone: "UTC" });
}
