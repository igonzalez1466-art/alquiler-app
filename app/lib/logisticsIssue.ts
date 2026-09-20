import type { Prisma } from "@prisma/client";

export const issueReasons = {
  NOT_RECEIVED: "Nie otrzymano przedmiotu",
  DAMAGED: "Przedmiot jest uszkodzony",
  MISSING_ITEMS: "Brakuje elementów lub akcesoriów",
  OTHER: "Inny problem",
} as const;

export type IssueReason = keyof typeof issueReasons;
export type IssueDetails = {
  reason: IssueReason | "LEGACY";
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
  return value as IssueDetails;
}

export function validateIssueInput(formData: FormData) {
  const reason = String(formData.get("reason") || "");
  const description = String(formData.get("description") || "").trim();
  if (!Object.hasOwn(issueReasons, reason)) throw new Error("Wybierz powód zgłoszenia.");
  if (!description || description.length > 2000) {
    throw new Error("Opisz problem — od 1 do 2000 znaków.");
  }
  return { reason: reason as IssueReason, description };
}

export function issueReasonLabel(reason: IssueDetails["reason"]) {
  return reason === "LEGACY" ? "Wcześniejsze zgłoszenie bez szczegółów" : issueReasons[reason];
}
