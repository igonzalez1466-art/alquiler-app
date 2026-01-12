"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "").toLowerCase().trim();
    const password = String(f.get("password") || "");

    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false, // 👈 muy importante: no redirigir automáticamente
    });

    setLoading(false);

    // ⚠️ Si hay error...
    if (res?.error) {
      if (res.error === "EMAIL_NOT_VERIFIED") {
        setError("Musisz najpierw zweryfikować swój adres e-mail.");
        return;
      }

      if (res.error === "CredentialsSignin") {
        setError("Nieprawidłowy adres e-mail lub hasło.");
        return;
      }

      // otros errores
      setError("Wystąpił nieoczekiwany błąd.");
      return;
    }

    // ✔️ Login correcto → redirigimos manualmente
    window.location.href = "/";
  }

  return (
    <div className="max-w-sm mx-auto mt-10">
      <h1 className="text-xl font-bold mb-4">Logowanie</h1>

      {error && <p className="mb-3 text-red-600">{error}</p>}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="twoj@email.com"
            autoComplete="email"
            className="w-full border rounded p-2 mt-1"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            Hasło
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full border rounded p-2 mt-1"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700 transition disabled:opacity-60"
        >
          {loading ? "Logowanie..." : "Login"}
        </button>

        <div className="text-center mt-3">
          <Link
            href="/forgot-password"
            className="text-sm text-blue-600 hover:underline"
          >
            Zapomniałeś(-aś) hasła?
          </Link>
        </div>
      </form>
    </div>
  );
}
