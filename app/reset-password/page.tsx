"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="max-w-sm mx-auto mt-10">
        <h1 className="text-xl font-bold mb-2">Resetowanie hasła</h1>
        <p className="text-red-600">Falta el token en la URL.</p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (password.length < 8) {
      setErr("Password must have at least 8 caracthers.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.message || "Password could not be reset");
      } else {
        setMsg("Hasło zostało zresetowane. Możesz się teraz zalogować.");
        // opcional: redirigir después de unos segundos
        setTimeout(() => router.push("/login"), 1500);
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
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Enter password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            className="w-full border rounded p-2 mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">
            Wprowadź ponownie swoje hasło
          </label>
          <input
            id="confirm"
            type="password"
            required
            minLength={8}
            className="w-full border rounded p-2 mt-1"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-60"
        >
          {loading ? "Saving..." : "Resetowanie hasła"}
        </button>
      </form>
    </div>
  );
}
