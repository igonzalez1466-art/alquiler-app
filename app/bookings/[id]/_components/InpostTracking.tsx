import { unstable_cache } from "next/cache";
import { fetchInpostTracking, type TrackingResult } from "@/app/lib/inpostTracking";
import { calendarDayOffset, formatCalendarDate, rentalCalendarDate, warsawCalendarDate } from "@/app/lib/rentalCalendarDate";

// The argument is part of the cache key; cache only the minimal public status.
const getTracking = unstable_cache(fetchInpostTracking, ["inpost-tracking-v2"], { revalidate: 300 });
const formatTime = (value: string) => new Date(value).toLocaleString("pl-PL", {
  timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short",
});

function PickupReadinessComparison({ result, rentalStartAt }: { result: TrackingResult; rentalStartAt: Date }) {
  if (result.kind !== "ok") return <p className="text-xs text-gray-600">Nie można teraz porównać daty udostępnienia przesyłki z początkiem najmu.</p>;
  if (!result.readyToPickupAt) return <p className="text-xs text-gray-600">InPost nie podał jeszcze daty „Przesyłka gotowa do odbioru”. Porównanie będzie dostępne po pojawieniu się tego statusu.</p>;
  const readyAt = new Date(result.readyToPickupAt);
  const startDate = rentalCalendarDate(rentalStartAt);
  const readyDate = warsawCalendarDate(readyAt);
  const dayOffset = calendarDayOffset(startDate, readyDate);
  return <div className={`rounded border p-3 space-y-1 ${dayOffset > 0 ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
    <p className="font-medium">Porównanie z pierwszym dniem najmu</p>
    <p>Pierwszy dzień najmu: <strong>{formatCalendarDate(startDate)}</strong></p>
    <p>Gotowa do odbioru w InPost: <strong>{formatTime(result.readyToPickupAt)}</strong></p>
    <p className="font-medium">{dayOffset > 0
      ? `Przesyłka była gotowa ${dayOffset} ${dayOffset === 1 ? "dzień" : "dni"} kalendarzowe po pierwszym dniu najmu. Możesz zgłosić utracony czas najmu.`
      : dayOffset === 0
        ? "Przesyłka była gotowa pierwszego dnia najmu. Sama godzina nie dowodzi spóźnienia, chyba że uzgodniono konkretną godzinę przekazania."
        : "Przesyłka była gotowa przed pierwszym dniem najmu. Późniejszy odbiór przez najemcę sam w sobie nie oznacza spóźnionej dostawy."}</p>
    <p className="text-xs text-gray-600">To data udostępnienia przesyłki, nie jej faktycznego odbioru. Jeśli InPost nie udostępnił jej na czas, strony mogą uzgodnić przesunięcie najmu albo zwrot za niewykorzystane dni; bez zgody sprawę wyjaśnia obsługa. Ten status nie ustala winy, nie zmienia ceny automatycznie i nie daje podstawy do potrącenia kaucji.</p>
  </div>;
}

export async function InpostPickupComparison({ number, rentalStartAt }: { number: string; rentalStartAt: Date }) {
  const result = await getTracking(number);
  return <PickupReadinessComparison result={result} rentalStartAt={rentalStartAt} />;
}

export default async function InpostTracking({ number, rentalStartAt }: { number: string; rentalStartAt?: Date }) {
  const result = await getTracking(number);
  return <div className="rounded border bg-gray-50 p-3 space-y-2 text-sm">
    <p className="font-medium">Śledzenie InPost</p>
    {result.kind === "ok" ? <>
      <p>{result.label}</p>
      {result.updatedAt && <p className="text-xs text-gray-600">Aktualizacja InPost: {formatTime(result.updatedAt)}</p>}
      <p className="text-xs text-gray-600">Sprawdzono: {formatTime(result.checkedAt)}</p>
      {rentalStartAt && <PickupReadinessComparison result={result} rentalStartAt={rentalStartAt} />}
      {result.events.length > 0 && <details className="border-t pt-2">
        <summary className="cursor-pointer font-medium text-blue-700">Historia przesyłki ({result.events.length})</summary>
        <ol className="mt-2 space-y-2 border-l border-gray-300 pl-3">
          {result.events.map((event, index) => <li key={`${event.occurredAt}-${index}`}>
            <span className="font-medium">{event.label}</span>
            <span className="block text-xs text-gray-600">{formatTime(event.occurredAt)}</span>
          </li>)}
        </ol>
      </details>}
    </> : <p className="text-gray-600">{result.kind === "missing"
      ? "Brak danych śledzenia. Sprawdź numer przesyłki. Nowe przesyłki mogą pojawić się z opóźnieniem, a starsze dane mogą być już niedostępne."
      : "Śledzenie jest chwilowo niedostępne. Możesz sprawdzić przesyłkę na stronie InPost."}</p>}
    {rentalStartAt && result.kind !== "ok" && <PickupReadinessComparison result={result} rentalStartAt={rentalStartAt} />}
    <a href={"https://inpost.pl/sledzenie-przesylek?number=" + encodeURIComponent(number)} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">Śledź przesyłkę w InPost ↗</a>
    <p className="text-xs text-gray-600">Status przewoźnika nie zastępuje potwierdzenia odbioru przedmiotu. Dane odświeżają się po ponownym otwarciu strony; mogą być opóźnione o kilka minut.</p>
  </div>;
}
