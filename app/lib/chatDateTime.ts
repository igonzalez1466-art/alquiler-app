const timeZone = "Europe/Warsaw";

function dayParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

function dayKey(date: Date) {
  const { year, month, day } = dayParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatChatDateTime(date: Date, now = new Date()): string {
  const today = dayKey(now);
  const { year, month, day } = dayParts(now);
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
  const messageDay = dayKey(date);
  const dayLabel = messageDay === today
    ? "Dzisiaj"
    : messageDay === yesterday
      ? "Wczoraj"
      : date.toLocaleDateString("pl-PL", { timeZone, day: "2-digit", month: "2-digit" });
  const timeLabel = date.toLocaleTimeString("pl-PL", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${dayLabel} ${timeLabel}`;
}
