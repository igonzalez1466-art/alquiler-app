import Link from "next/link";
export default function NotFound() {
  return <div className="space-y-4 py-10"><h1 className="text-xl font-bold">Nie znaleziono strony</h1><p>Sprawdź adres lub wróć na stronę główną.</p><Link href="/" className="inline-block rounded bg-indigo-600 px-4 py-2 text-white">Strona główna</Link></div>;
}
