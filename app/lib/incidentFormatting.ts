const pln = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });
export function formatIncidentMoney(cents: number): string {
  return pln.format(cents / 100);
}

/** Format the system-generated refund suffix in historical proposals without rewriting stored evidence. */
export function formatIncidentEvidenceText(text: string): string {
  if (!text.startsWith("Propozycja:")) return text;
  return text.replace(/ · Zwrot najmu: (\d+) gr$/, (suffix, raw: string) => {
    const cents = Number(raw);
    return Number.isSafeInteger(cents) ? " · Zwrot najmu: " + formatIncidentMoney(cents) : suffix;
  });
}
