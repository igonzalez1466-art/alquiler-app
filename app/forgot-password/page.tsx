"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      // ⚠️ Asegúrate de parsear solo si hay JSON
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        /* si la respuesta no es JSON, no rompas */
      }

      if (!res.ok) {
        setErr(data?.message || "Error enviando el enlace");
      } else {
        setMsg(data?.message || "If the email address exist, you will receive an email.");
      }
    } catch (e: any) {
      setErr(e?.message || "Error de red");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-10">
      <h1 className="text-xl font-bold mb-4">Resetowanie hasła</h1>

      {msg && <p className="text-green-600 mb-3">{msg}</p>}
      {err && <p className="text-red-600 mb-3">{err}</p>}

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
            name="email" // 👈 añade el name, ayuda a server y accesibilidad
            type="email"
            required
            className="w-full border rounded p-2 mt-1"
            placeholder="twoj@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700 transition disabled:opacity-60"
        >
          {loading ? "Sending..." : "Wyślij link"}
        </button>
      </form>
    </div>
  );
}
