import type { IncidentReason, IncidentStage } from "@prisma/client";

export const incidentReasons: Record<IncidentReason, string> = {
  NOT_SHIPPED: "Przedmiot nie został wysłany / przekazany",
  NOT_RECEIVED: "Nie otrzymałem przedmiotu",
  NOT_AS_DESCRIBED: "Przedmiot niezgodny z opisem",
  DAMAGED_ON_ARRIVAL: "Przedmiot uszkodzony przy dostawie",
  LATE_DELIVERY: "Opóźniona dostawa",
  RETURN_NOT_RECEIVED: "Nie otrzymałem zwrotu",
  DAMAGED_ON_RETURN: "Uszkodzenie przy zwrocie",
  LATE_RETURN: "Zwrot po terminie",
  NOT_RETURNED: "Przedmiot nie został zwrócony",
  OTHER: "Inny problem",
};
export const reasonsForStage: Record<IncidentStage, IncidentReason[]> = {
  DELIVERY: ["NOT_SHIPPED", "NOT_RECEIVED", "NOT_AS_DESCRIBED", "DAMAGED_ON_ARRIVAL", "LATE_DELIVERY", "OTHER"],
  RETURN: ["RETURN_NOT_RECEIVED", "DAMAGED_ON_RETURN", "LATE_RETURN", "NOT_RETURNED", "OTHER"],
};
export function rentalAmounts(rent: number, fee: number, owner: number, refund: number) {
  if (![rent, fee, owner, refund].every(Number.isSafeInteger) || rent <= 0 || fee < 0 || owner < 0 ||
    rent !== fee + owner || refund < 0 || refund > rent) throw new Error("Nieprawidłowe kwoty rozliczenia.");
  const remaining = rent - refund;
  const remainingFee = Math.round(fee * remaining / rent);
  return { refund, fee: remainingFee, payout: remaining - remainingFee };
}
export function validateIncidentReason(stage: IncidentStage, reason: string): IncidentReason {
  if (!reasonsForStage[stage].includes(reason as IncidentReason)) throw new Error("Nieprawidłowy powód zgłoszenia.");
  return reason as IncidentReason;
}

export function incidentRequiresPhotos(stage: string, reason: string): boolean {
  return stage === "DELIVERY" && ["NOT_AS_DESCRIBED", "DAMAGED_ON_ARRIVAL"].includes(reason);
}
export const REQUIRED_INCIDENT_PHOTOS_MESSAGE = "Dodaj co najmniej jedno zdjęcie przedmiotu, aby zgłosić niezgodność z opisem lub uszkodzenie.";
export function canActOnIncident(incident: { stage: string; status: string }, isOwner: boolean): boolean {
  if (incident.status === "AWAITING_OWNER") return isOwner;
  if (incident.status === "AWAITING_RENTER") return !isOwner;
  // An unresolved case can be resumed by the party responsible for proposing a solution.
  if (["OPEN", "ESCALATED"].includes(incident.status)) return incident.stage === "DELIVERY" ? isOwner : !isOwner;
  return false;
}
export const INCIDENT_WAIT_MESSAGE = "Teraz czekamy na działanie drugiej strony. Dostępne działania są zablokowane.";
export const INCIDENT_PHOTOS_LOCKED_MESSAGE = "Zdjęcia zostały już zapisane. Nie można dodać kolejnych zdjęć do tego zgłoszenia.";