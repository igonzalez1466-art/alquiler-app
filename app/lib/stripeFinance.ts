import Stripe from "stripe";
export type FinanceTab = "payments" | "refunds" | "transfers" | "balance";
export type FinanceRow = { id: string; created: number; currency: string; amount: number; fee: number | null; net: number | null; status: string; kind: string; bookingId?: string; bookingNumber?: string; references: string[]; destination?: string; returned?: number };
export function financeTab(value?: string): FinanceTab { return ["refunds", "transfers", "balance"].includes(value ?? "") ? value as FinanceTab : "payments"; }
export function financeCursor(value: string | undefined, tab: FinanceTab) {
  const prefix = { payments: "ch", refunds: "re", transfers: "tr", balance: "txn" }[tab];
  return typeof value === "string" && new RegExp(`^${prefix}_[A-Za-z0-9]{1,200}$`).test(value) ? value : undefined;
}
function objectId(value: string | { id: string } | null | undefined) { return typeof value === "string" ? value : value?.id; }
function metadata(value: Stripe.Metadata | null | undefined) { return { bookingId: value?.bookingId, bookingNumber: value?.bookingNumber }; }
export const currencyAmount = (amount: number, currency: string) => {
  const zeroDecimal = ["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "vnd", "vuv", "xaf", "xof", "xpf"].includes(currency.toLowerCase());
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: currency.toUpperCase() }).format(amount / (zeroDecimal ? 1 : ["bhd", "jod", "kwd", "omr", "tnd"].includes(currency.toLowerCase()) ? 1000 : 100));
};
export async function stripeFinanceRows(stripe: Stripe, tab: FinanceTab, days: number | null, cursor?: string) {
  const params = { limit: 25, ...(days ? { created: { gte: Math.floor(Date.now() / 1000) - days * 86400 } } : {}), ...(cursor ? { starting_after: cursor } : {}) };
  if (tab === "payments") {
    const list = await stripe.charges.list(params);
    return { hasMore: list.has_more, rows: list.data.map((c): FinanceRow => ({ id: c.id, created: c.created, currency: c.currency, amount: c.amount, fee: null, net: null,
      status: c.status === "failed" ? "Nieudana" : c.status === "pending" ? "Oczekuje" : !c.captured ? "Autoryzowana — nie pobrano" : c.refunded ? "Zwrócona w całości" : c.amount_refunded > 0 ? "Częściowo zwrócona" : "Pobrana",
      kind: "Płatność", ...metadata(c.metadata), references: [c.id, objectId(c.payment_intent)].filter((id): id is string => !!id), returned: c.amount_refunded })) };
  }
  if (tab === "refunds") {
    const list = await stripe.refunds.list(params);
    const labels: Record<string, string> = { succeeded: "Zwrócono", pending: "Oczekuje", failed: "Nieudany", canceled: "Anulowany", requires_action: "Wymaga działania" };
    return { hasMore: list.has_more, rows: list.data.map((r): FinanceRow => ({ id: r.id, created: r.created, currency: r.currency, amount: r.amount, fee: null, net: null,
      status: labels[r.status ?? ""] ?? "Status niedostępny", kind: "Zwrot", ...metadata(r.metadata), references: [r.id, objectId(r.payment_intent), objectId(r.charge)].filter((id): id is string => !!id) })) };
  }
  if (tab === "transfers") {
    const list = await stripe.transfers.list(params);
    return { hasMore: list.has_more, rows: list.data.map((t): FinanceRow => ({ id: t.id, created: t.created, currency: t.currency, amount: t.amount, fee: null, net: null,
      status: t.reversed ? "Cofnięta" : t.amount_reversed > 0 ? "Częściowo cofnięta" : "Przekazano na saldo odbiorcy", kind: t.metadata.type === "deposit_compensation" ? "Kaucja — rekompensata" : t.metadata.type === "rental_owner_payout" ? "Najem" : "Transfer",
      ...metadata(t.metadata), references: [t.id], destination: objectId(t.destination), returned: t.amount_reversed })) };
  }
  const list = await stripe.balanceTransactions.list({ ...params, expand: ["data.source"] });
  const kinds: Record<string, string> = { charge: "Płatność", payment: "Płatność", refund: "Zwrot", payment_refund: "Zwrot", transfer: "Transfer", payout: "Wypłata bankowa", stripe_fee: "Opłata Stripe", transfer_refund: "Cofnięcie transferu" };
  return { hasMore: list.has_more, rows: list.data.map((t): FinanceRow => {
    const source = t.source && typeof t.source === "object" ? t.source : null;
    const meta = source && "metadata" in source ? source.metadata : undefined;
    return { id: t.id, created: t.created, currency: t.currency, amount: t.amount, fee: t.fee, net: t.net, status: t.status === "available" ? "Dostępne" : "Oczekujące", kind: kinds[t.type] ?? t.type,
      ...metadata(meta), references: [objectId(t.source), source && "payment_intent" in source ? objectId(source.payment_intent) : undefined].filter((id): id is string => !!id) };
  }) };
}
