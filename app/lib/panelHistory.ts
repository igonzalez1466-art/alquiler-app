import { Prisma, type Booking } from "@prisma/client";
export type HistoryParams = { page?: string; booking?: string; state?: string; role?: string; kind?: string };
export function pageNumber(value?: string) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 1000000) : 1; }
export function bookingFilter(value?: string): Prisma.BookingWhereInput {
  if (!value?.trim()) return {};
  const text = value.trim().replace(/^#/, "");
  const n = Number(text);
  return /^\d+$/.test(text) && Number.isSafeInteger(n) && n <= 2147483647 ? { bookingNumber: n } : { id: "__invalid_search__" };
}
const depositIssue: Prisma.BookingWhereInput = { OR: [{ depositClaim: { not: Prisma.AnyNull } }, { damageClaimStatus: { not: "NONE" } }] };
const deliveryIssue: Prisma.BookingWhereInput = { OR: [{ deliveryIssue: { not: Prisma.AnyNull } }, { deliveryConfirmationStatus: "DISPUTED" }] };
const returnIssue: Prisma.BookingWhereInput = { OR: [{ returnIssue: { not: Prisma.AnyNull } }, { returnConfirmationStatus: "DISPUTED" }] };
const openIssue: Prisma.BookingWhereInput = { OR: [
  { deliveryConfirmationStatus: "DISPUTED" }, { returnConfirmationStatus: "DISPUTED" },
  { damageClaimStatus: { in: ["OPEN", "CLAIMED"] } },
  { depositClaim: { path: ["status"], equals: "PENDING" } }, { depositClaim: { path: ["status"], equals: "DISPUTED" } },
  { depositClaim: { path: ["status"], equals: "APPROVED" }, settlementCompletedAt: null },
] };
export function disputeWhere(p: HistoryParams): Prisma.BookingWhereInput {
  const stageOpen: Prisma.BookingWhereInput = p.kind === "delivery" ? { deliveryConfirmationStatus: "DISPUTED" } : p.kind === "return" ? { returnConfirmationStatus: "DISPUTED" } : openIssue;
  return { AND: [p.kind === "delivery" ? deliveryIssue : p.kind === "return" ? returnIssue : p.kind === "deposit" ? depositIssue : { OR: [deliveryIssue, returnIssue, depositIssue] }, bookingFilter(p.booking), ...(p.state === "open" ? [stageOpen] : p.state === "closed" ? [{ NOT: stageOpen }] : [])] };
}
export function transactionWhere(userId: string, p: HistoryParams): Prisma.BookingWhereInput {
  return { AND: [p.role === "owner" ? { ownerId: userId } : p.role === "renter" ? { renterId: userId } : { OR: [{ ownerId: userId }, { renterId: userId }] }, bookingFilter(p.booking),
    ...(p.state === "settled" ? [{ settlementCompletedAt: { not: null } }] : p.state === "pending" ? [{ settlementCompletedAt: null }] : [])] };
}
export const money = (n: number | null) => n === null ? "Brak danych" : new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(n / 100);
export const date = (d: Date | null) => d ? d.toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short" }) : "—";
export const paymentLabels: Record<string, string> = { PENDING: "Oczekuje na płatność", AUTHORIZED: "Autoryzowana", PAID: "Opłacona", REFUNDED: "Zwrócona", FAILED: "Nieudana", CANCELLED: "Anulowana" };
export const depositLabels: Record<string, string> = { NONE: "Brak kaucji", PENDING: "Oczekuje na wpłatę", PAID: "Wpłacona", REFUND_PENDING: "Zwrot oczekuje na potwierdzenie", REFUNDED: "Zwrócona", PARTIALLY_REFUNDED: "Częściowo zwrócona", RETAINED: "Zatrzymana", FAILED: "Błąd rozliczenia kaucji" };
type FinancialBooking = Pick<Booking, "ownerId" | "renterId" | "rentAmountCents" | "depositCents" | "depositRetainedCents" | "depositRefundedCents" | "depositStatus" | "platformFeeCents" | "ownerPayoutCents" | "ownerTransferId" | "ownerTransferCents" | "depositTransferId" | "depositTransferredCents">;
export function financialRows(b: FinancialBooking, userId: string): [string, number | null][] {
  if (b.ownerId !== userId && b.renterId !== userId) throw new Error("Brak dostępu");
  const rows: [string, number | null][] = [["Koszt najmu", b.rentAmountCents], ["Kaucja w rezerwacji", b.depositCents], ["Zatrzymana kaucja", b.depositRetainedCents], [b.depositStatus === "REFUND_PENDING" ? "Zwrot kaucji — zlecony" : ["REFUNDED", "PARTIALLY_REFUNDED"].includes(b.depositStatus) ? "Zwrot kaucji — potwierdzony" : "Zwrot kaucji — zapisany", b.depositRefundedCents]];
  if (b.ownerId === userId) {
    const rent = b.ownerTransferId ? b.ownerTransferCents : null;
    const compensation = b.depositTransferId ? b.depositTransferredCents : b.depositRetainedCents === 0 ? 0 : null;
    rows.push(["Prowizja MojaSzafa", b.platformFeeCents], ["Najem netto — należny", b.ownerPayoutCents], ["Najem — przekazano", rent], ["Kaucja — przekazano", compensation], ["Łącznie przekazano na saldo Stripe", rent === null || compensation === null ? null : rent + compensation]);
  }
  return rows;
}
