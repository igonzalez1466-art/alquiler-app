"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="space-y-4 py-10"><h1 className="text-xl font-bold">Nie udało się wyświetlić strony</h1><p>Spróbuj ponownie. Jeśli problem się powtarza, skontaktuj się z obsługą serwisu.</p><button onClick={reset} className="rounded bg-indigo-600 px-4 py-2 text-white">Spróbuj ponownie</button></div>;
}
