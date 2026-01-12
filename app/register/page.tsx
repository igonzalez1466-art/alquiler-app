"use client";

import { useState } from "react";

function isStrongPassword(pw: string) {
  return (
    pw.length >= 8 &&
    /[a-z]/.test(pw) &&
    /[A-Z]/.test(pw) &&
    /\d/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw)
  );
}

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      password: String(fd.get("password") || ""),
    };

    if (!isStrongPassword(body.password)) {
      setLoading(false);
      setError(
        "Hasło musi mieć co najmniej 8 znaków oraz zawierać wielką literę, małą literę, cyfrę i znak specjalny."
      );
      return;
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data?.error || "Nie udało się zarejestrować");
      return;
    }

    setSuccess(
      "Konto zostało utworzone. Sprawdź swoją skrzynkę e-mail i zweryfikuj konto, aby móc się zalogować."
    );

    // Opcjonalnie: e.currentTarget.reset();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white p-6 rounded shadow flex flex-col gap-3"
      >
        <h1 className="text-xl font-bold mb-2">Rejestracja</h1>

        <input
          name="name"
          type="text"
          placeholder="Imię"
          className="border rounded px-3 py-2"
        />

        <input
          name="email"
          type="email"
          placeholder="E-mail"
          className="border rounded px-3 py-2"
          required
        />

        <input
          name="password"
          type="password"
          placeholder="Hasło (min. 8, Aa1!)"
          className="border rounded px-3 py-2"
          required
          minLength={8}
        />

        <p className="text-xs text-gray-500">
          Hasło musi zawierać min. 8 znaków, wielką i małą literę, cyfrę oraz znak specjalny.
        </p>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 text-white rounded py-2 disabled:opacity-60"
        >
          {loading ? "Tworzenie konta..." : "Zarejestruj się"}
        </button>
      </form>
    </div>
  );
}
