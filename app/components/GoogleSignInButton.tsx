"use client";

import { signIn } from "next-auth/react";
import { useRef, useState } from "react";

export default function GoogleSignInButton() {
  const locked = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loginWithGoogle() {
    if (locked.current) return;
    locked.current = true;
    setLoading(true);
    setError("");
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch {
      locked.current = false;
      setLoading(false);
      setError("Nie udało się rozpocząć logowania przez Google. Spróbuj ponownie.");
    }
  }

  return <div className="space-y-2">
    <button type="button" onClick={loginWithGoogle} disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60">
      {loading ? <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" /> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
        <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.39 13.93A6.01 6.01 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.55l3.35-2.62Z" />
        <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z" />
      </svg>}
      {loading ? "Przekierowanie do Google…" : "Kontynuuj z Google"}
    </button>
    {loading && <p role="status" aria-live="polite" className="text-center text-xs text-gray-600">Otwieramy bezpieczne logowanie Google…</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>;
}
