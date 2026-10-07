"use client";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="pl"><body><main style={{ maxWidth: 640, margin: "60px auto", padding: 24, fontFamily: "sans-serif" }}><h1>Nie udało się wyświetlić strony</h1><p>Spróbuj ponownie za chwilę.</p><button onClick={reset}>Spróbuj ponownie</button></main></body></html>;
}
