import type { Prisma } from "@prisma/client";
import { readIssue, issueReasonLabel } from "@/app/lib/logisticsIssue";
import ResolveIssueForm from "./ResolveIssueForm";

export default function LogisticsIssuePanel({ bookingId, stage, stored, disputed, recipientId, userId, canResolve }: {
  bookingId: string;
  stage: "DELIVERY" | "RETURN";
  stored: Prisma.JsonValue | null;
  disputed: boolean;
  recipientId: string;
  userId: string;
  canResolve: boolean;
}) {
  const issue = readIssue(stored);
  if (!issue && !disputed) return null;
  return <div className={`rounded border p-3 space-y-3 text-sm ${disputed ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
    <p role="status">{disputed ? "Problem został zgłoszony. Potwierdzenie odbioru jest wstrzymane." : "Problem rozwiązany — odbiór potwierdzony."}</p>
    {issue && <>
      <p><strong>Powód:</strong> {issueReasonLabel(issue.reason)}</p>
      {issue.description && <p className="whitespace-pre-wrap break-words">{issue.description}</p>}
      {issue.reportedAt && <p>Zgłoszono: {new Date(issue.reportedAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>}
      {issue.resolvedAt && <p>Rozwiązano: {new Date(issue.resolvedAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>}
    </>}
    {disputed && <p>Jeśli sprawa wymaga wyjaśnienia, skontaktuj się z obsługą serwisu.</p>}
    {disputed && canResolve && userId === recipientId && (stored === null || (issue?.reportedById === userId && issue.resolvedAt === null)) &&
      <ResolveIssueForm bookingId={bookingId} stage={stage} />}
  </div>;
}
