"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Leer parámetros de la URL (si existen)
  const emailFromUrl = searchParams.get("email") || "";
  const codeFromUrl = searchParams.get("code") || "";

  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState(codeFromUrl);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ⏳ Si llegó email+code por URL → verificar automáticamente
  useEffect(() => {
    if (emailFromUrl && codeFromUrl) {
      verify(emailFromUrl, codeFromUrl);
    }
  }, [emailFromUrl, codeFromUrl]);

  async function verify(emailToVerify: string, codeToVerify: string) {
    setMsg("Sprawdzam kod...");
    setLoading(true);

    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailToVerify,
        code: codeToVerify,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMsg(data.error || "Błąd weryfikacji");
      return;
    }

    setMsg("E-mail zweryfikowany 🎉 Możesz się teraz zalogować.");
    // Redirigir automáticamente después de 2 segundos
    setTimeout(() => router.push("/login"), 2000);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    verify(email, code);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white p-6 rounded shadow flex flex-col gap-3"
      >
        <h1 className="text-xl font-bold mb-2 text-center">Weryfikacja e-maila</h1>

        <input
          type="email"
          placeholder="E-mail"
          className="border rounded px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Kod z e-maila"
          className="border rounded px-3 py-2"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />

        {msg && <p className="text-sm text-center">{msg}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white rounded py-2 disabled:opacity-60"
        >
          {loading ? "Sprawdzam..." : "Potwierdź e-mail"}
        </button>
      </form>
    </div>
  );
}
