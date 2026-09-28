import type { Prisma } from "@prisma/client";

export const issueReasons = {
  NOT_RECEIVED: "Nie otrzymano przedmiotu",
  DAMAGED: "Przedmiot jest uszkodzony",
  DIRTY: "Przedmiot jest zabrudzony",
  MISSING_ITEMS: "Brakuje elementów lub akcesoriów",
  WRONG_ITEM: "Przedmiot nie jest tym z ogłoszenia",
  LATE_DELIVERY: "Opóźniona dostawa",
  LATE_RETURN: "Przedmiot zwrócono po terminie",
  OTHER: "Inny problem",
} as const;

export type IssueReason = keyof typeof issueReasons;
// OTHER remains readable for historical reports, but is not available for new reports.
export const reportableIssueReasons = {
  DELIVERY: ["NOT_RECEIVED", "DAMAGED", "DIRTY", "MISSING_ITEMS", "WRONG_ITEM", "LATE_DELIVERY"],
  RETURN: ["NOT_RECEIVED", "DAMAGED", "DIRTY", "MISSING_ITEMS", "LATE_RETURN"],
} as const;

export type IssueDetails = {
  reason: IssueReason | "LEGACY";
  received?: boolean;
  description: string;
  reportedById: string;
  reportedAt: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
};

export function readIssue(value: Prisma.JsonValue | null): IssueDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const reason = value.reason;
  if (typeof reason !== "string" || !(Object.hasOwn(issueReasons, reason) || reason === "LEGACY") ||
    typeof value.description !== "string" || typeof value.reportedById !== "string" ||
    !(value.reportedAt === null || typeof value.reportedAt === "string") ||
    !(value.resolvedById === null || typeof value.resolvedById === "string") ||
    !(value.resolvedAt === null || typeof value.resolvedAt === "string")) return null;
  if (value.received !== undefined && typeof value.received !== "boolean") return null;
  return value as IssueDetails;
}

export function validateIssueInput(formData: FormData, stage: "DELIVERY" | "RETURN") {
  const reason = String(formData.get("reason") || "");
  const description = String(formData.get("description") || "").trim();
  if (!Object.hasOwn(issueReasons, reason)) throw new Error("Wybierz powód zgłoszenia.");
  if (!(reportableIssueReasons[stage] as readonly string[]).includes(reason)) {
    throw new Error("Ten powód nie jest dostępny na tym etapie.");
  }
  if (!description || description.length > 2000) {
    throw new Error("Opisz problem — od 1 do 2000 znaków.");
  }
  return { reason: reason as IssueReason, description };
}

export function issueReasonLabel(reason: IssueDetails["reason"]) {
  return reason === "LEGACY" ? "Wcześniejsze zgłoszenie bez szczegółów" : issueReasons[reason];
}

// A carrier's delivered status alone does not prove personal receipt.
export function issueConfirmsReceipt(issue: IssueDetails | null): boolean {
  return !!issue && (issue.reason === "DAMAGED" || issue.reason === "DIRTY" || issue.reason === "MISSING_ITEMS" ||
    issue.reason === "WRONG_ITEM" || issue.reason === "LATE_RETURN" ||
    ((issue.reason === "OTHER" || issue.reason === "LATE_DELIVERY") && issue.received === true));
}
export function hasReturnReceipt(b: { returnConfirmationStatus: string; returnIssue: Prisma.JsonValue | null; ownerId: string }): boolean {
  const issue = readIssue(b.returnIssue);
  return ["CONFIRMED", "AUTO_CONFIRMED"].includes(b.returnConfirmationStatus) ||
    (issue?.reportedById === b.ownerId && issueConfirmsReceipt(issue));
}
