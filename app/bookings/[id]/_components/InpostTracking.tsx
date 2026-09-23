import { unstable_cache } from "next/cache";
import { fetchInpostTracking } from "@/app/lib/inpostTracking";

// The argument is part of the cache key; cache only the minimal public status.
const getTracking = unstable_cache(fetchInpostTracking, ["inpost-tracking-v1"], { revalidate: 300 });
const formatTime = (value: string) => new Date(value).toLocaleString("pl-PL", {
  timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short",
});

export default async function InpostTracking({ number }: { number: string }) {
  const result = await getTracking(number);
  return <div className="rounded border bg-gray-50 p-3 space-y-2 text-sm">
    <p className="font-medium">Śledzenie InPost</p>
    {result.kind === "ok" ? <>
      <p>{result.label}</p>
      {result.updatedAt && <p className="text-xs text-gray-600">Aktualizacja InPost: {formatTime(result.updatedAt)}</p>}
      <p className="text-xs text-gray-600">Sprawdzono: {formatTime(result.checkedAt)}</p>
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
    <a href={"https://inpost.pl/sledzenie-przesylek?number=" + encodeURIComponent(number)} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">Śledź przesyłkę w InPost ↗</a>
    <p className="text-xs text-gray-600">Status przewoźnika nie zastępuje potwierdzenia odbioru przedmiotu. Dane odświeżają się po ponownym otwarciu strony; mogą być opóźnione o kilka minut.</p>
  </div>;
}
