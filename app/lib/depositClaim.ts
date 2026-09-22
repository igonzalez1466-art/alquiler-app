export const claimReasons = {
  DAMAGE: "Uszkodzenie", STAINING: "Zabrudzenie", MISSING_ITEM: "Brak elementu",
  LATE_RETURN: "Opóźniony zwrot", NOT_RETURNED: "Przedmiot nie został zwrócony",
  CLEANING: "Koszt czyszczenia", OTHER: "Inny powód",
} as const;

export function canClaimNotReturned(booking: {
  endDate: Date;
  shippingStatus: string;
  deliveryConfirmationStatus: string;
  returnStatus: string;
  returnConfirmationStatus: string;
}, now: Date = new Date()) {
  return booking.shippingStatus === "DELIVERED" &&
    ["CONFIRMED", "AUTO_CONFIRMED"].includes(booking.deliveryConfirmationStatus) &&
    booking.returnStatus === "PENDING" &&
    booking.returnConfirmationStatus === "NOT_REQUESTED" &&
    now.getTime() >= booking.endDate.getTime() + 24 * 60 * 60 * 1000;
}
export type DepositClaim = {
  id: string;
  status: "PENDING" | "DISPUTED" | "APPROVED";
  proposedById: string;
  proposedAt: string;
  retainedCents: number;
  reasonCode: keyof typeof claimReasons;
  reason: string;
  renterResponse: string | null;
  respondedAt: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  approvedRetainedCents: number | null;
  resolutionSource: "RENTER" | "SUPPORT" | null;
  resolutionNote: string | null;
};

export function readDepositClaim(value: unknown): DepositClaim | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const c = value as Partial<DepositClaim>;
  if (typeof c.id !== "string" || !c.id || !["PENDING", "DISPUTED", "APPROVED"].includes(c.status ?? "") ||
    typeof c.proposedById !== "string" || typeof c.proposedAt !== "string" ||
    !Number.isSafeInteger(c.retainedCents) || (c.retainedCents ?? 0) <= 0 ||
    !Object.hasOwn(claimReasons, c.reasonCode ?? "") || typeof c.reason !== "string" || !c.reason.trim()) return null;
  if (c.status === "APPROVED" && (
    !Number.isSafeInteger(c.approvedRetainedCents) || (c.approvedRetainedCents ?? -1) < 0 ||
    (c.approvedRetainedCents ?? Infinity) > c.retainedCents! ||
    typeof c.approvedById !== "string" || !c.approvedById || typeof c.approvedAt !== "string" ||
    !["RENTER", "SUPPORT"].includes(c.resolutionSource ?? "") ||
    (c.resolutionSource === "RENTER" && c.approvedRetainedCents !== c.retainedCents))) return null;
  return c as DepositClaim;
}

export function parseClaimAmount(value: FormDataEntryValue | null) {
  const input = String(value ?? "").trim().replace(",", ".");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(input)) throw new Error("Podaj kwotę w złotych, maksymalnie dwa miejsca po przecinku.");
  const [whole, fraction = ""] = input.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function claimSettlement(claim: DepositClaim, depositCents: number) {
  if (claim.status !== "APPROVED" || claim.approvedRetainedCents === null ||
    claim.retainedCents > depositCents) throw new Error("Roszczenie nie zostało zatwierdzone.");
  const retainedCents = claim.approvedRetainedCents;
  return {
    kind: retainedCents === 0 ? "full" as const : retainedCents === depositCents ? "retain" as const : "partial" as const,
    retainedCents, refundCents: depositCents - retainedCents,
    reason: retainedCents > 0 ? claim.reason : null,
    reasonCode: retainedCents > 0 ? claim.reasonCode : null,
  };
}
