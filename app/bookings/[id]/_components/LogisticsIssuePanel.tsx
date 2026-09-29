import type { Prisma } from "@prisma/client";
import { Suspense } from "react";
import { readIssue, issueReasonLabel, issueConfirmsReceipt } from "@/app/lib/logisticsIssue";
import { logisticsIssueGuidance, logisticsTimeObservations } from "@/app/lib/logisticsIssueGuidance";
import { isInpost, normalizeInpostNumber } from "@/app/lib/inpostTracking";
import ResolveIssueForm from "./ResolveIssueForm";
import { InpostPickupComparison } from "./InpostTracking";

type IssueFacts = {
  expectedAt: Date;
  sentAt: Date | null;
  receivedAt: Date | null;
  carrier: string | null;
  trackingNumber: string | null;
  ownerPhotos: number;
  renterPhotos: number;
  rentCents: number | null;
  depositCents: number | null;
};

const datePL = (date: Date | null) => date?.toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" }) ?? "—";
const moneyPL = (cents: number) => new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(cents / 100);

export default function LogisticsIssuePanel({ bookingId, stage, stored, disputed, recipientId, userId, canResolve, facts, receiptConfirmed = false, hasDepositClaim = false, claimNotReturned = false }: {
  bookingId: string;
  stage: "DELIVERY" | "RETURN";
  stored: Prisma.JsonValue | null;
  disputed: boolean;
  recipientId: string;
  userId: string;
  canResolve: boolean;
  facts: IssueFacts;
  receiptConfirmed?: boolean;
  hasDepositClaim?: boolean;
  claimNotReturned?: boolean;
}) {
  const issue = readIssue(stored);
  if (!issue && !disputed) return null;
  const guidance = logisticsIssueGuidance(stage, issue?.reason ?? "LEGACY");
  const observations = logisticsTimeObservations(stage, facts.expectedAt, facts.sentAt, facts.receivedAt);
  const tracking = isInpost(facts.carrier) ? normalizeInpostNumber(facts.trackingNumber) : null;
  return <div className={`rounded border p-3 space-y-3 text-sm ${disputed ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
    <p role="status">{disputed ? (stage === "RETURN" && hasDepositClaim ? (claimNotReturned ? "Przedmiot nie został zwrócony. Szczegóły rozliczenia kaucji znajdują się poniżej." : "Przedmiot został odebrany. Trwa uzgadnianie rozliczenia kaucji — szczegóły poniżej.") : (receiptConfirmed || issueConfirmsReceipt(issue)) ? (stage === "RETURN" ? "Przedmiot odebrany z zastrzeżeniami. Kaucja pozostaje zablokowana do rozwiązania sprawy." : "Przedmiot odebrany z zastrzeżeniami. Zgłoszony problem wymaga rozwiązania.") : "Problem został zgłoszony. Odbiór przedmiotu nie został potwierdzony.") : "Problem rozwiązany — odbiór potwierdzony."}</p>
    {issue && <>
      <p><strong>Powód:</strong> {issueReasonLabel(issue.reason)}</p>
      {issue.description && <p className="whitespace-pre-wrap break-words">{issue.description}</p>}
      {issue.reportedAt && <p>Zgłoszono: {new Date(issue.reportedAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>}
      {issue.resolvedAt && <p>Rozwiązano: {new Date(issue.resolvedAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>}
    </>}
    <div className="space-y-3 rounded border bg-white p-3 text-gray-900">
      <h4 className="font-semibold">Fakty i możliwe rozwiązanie</h4>
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <div><dt className="font-medium">{stage === "DELIVERY" ? "Początek najmu" : "Koniec najmu"}</dt><dd>{datePL(facts.expectedAt)}</dd></div>
        <div><dt className="font-medium">Wysłano w aplikacji</dt><dd>{datePL(facts.sentAt)}</dd></div>
        <div><dt className="font-medium">Odbiór zapisany w aplikacji</dt><dd>{datePL(facts.receivedAt)}</dd></div>
        <div><dt className="font-medium">Przewoźnik / numer</dt><dd>{facts.carrier ?? "—"}{facts.trackingNumber ? ` · ${facts.trackingNumber}` : ""}</dd></div>
        <div><dt className="font-medium">Zdjęcia w tym etapie</dt><dd>Właściciel: {facts.ownerPhotos}/3 · Najemca: {facts.renterPhotos}/3</dd></div>
        <div><dt className="font-medium">Kwoty rezerwacji</dt><dd>Najem: {facts.rentCents === null ? "—" : moneyPL(facts.rentCents)} · Kaucja: {facts.depositCents === null ? "—" : moneyPL(facts.depositCents)}</dd></div>
      </dl>
      {tracking && <a className="inline-block text-blue-700 underline" href={`https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(tracking)}`} target="_blank" rel="noopener noreferrer">Sprawdź historię InPost ↗</a>}
      {stage === "DELIVERY" && tracking && <Suspense fallback={<p className="text-xs text-gray-600">Porównywanie dat InPost…</p>}>
        <InpostPickupComparison number={tracking} rentalStartAt={facts.expectedAt} />
      </Suspense>}
      {observations.length > 0 && <ul className="list-disc space-y-1 pl-5">{observations.map(value => <li key={value}>{value}</li>)}</ul>}
      <p><strong>Następny krok:</strong> {guidance.nextStep}</p>
      <p><strong>Cena najmu:</strong> {guidance.rent}</p>
      <p><strong>Kaucja:</strong> {guidance.deposit}</p>
      <p className="text-xs text-gray-600">Daty i status przewoźnika pomagają wyjaśnić sprawę, ale nie rozstrzygają automatycznie odpowiedzialności. To podpowiedzi; zgłoszenie nie zmienia płatności ani kaucji.</p>
    </div>
    {disputed && <p>Jeśli sprawa wymaga wyjaśnienia, skontaktuj się z obsługą serwisu.</p>}
    {disputed && canResolve && userId === recipientId && (stored === null || (issue?.reportedById === userId && issue.resolvedAt === null)) &&
      <ResolveIssueForm bookingId={bookingId} stage={stage} />}
  </div>;
}
