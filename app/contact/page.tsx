"use client";
import { useState } from "react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bookingNumber, setBookingNumber] = useState(""); // ✅ NUEVO
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, bookingNumber, message }), // ✅ envía bookingNumber
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Nie udało się wysłać");

      setStatus("✅ Wiadomość wysłana");
      setName("");
      setEmail("");
      setBookingNumber(""); // ✅ reset
      setMessage("");
    } catch (err: any) {
      setStatus("❌ " + (err?.message || "Błąd sieci"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <h1 className="text-xl font-bold mb-4">Kontakt</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Twoje imię"
          className="w-full border rounded p-2"
          required
        />

        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Adres e-mail"
          className="w-full border rounded p-2"
          required
        />

        {/* ✅ NUEVO: Número de reserva */}
        <input
          name="bookingNumber"
          value={bookingNumber}
          onChange={(e) => setBookingNumber(e.target.value)}
          placeholder="Numer rezerwacji (opcjonalnie)"
          className="w-full border rounded p-2"
        />

        <textarea
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Wpisz swoją wiadomość"
          className="w-full border rounded p-2 h-32"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-60"
        >
          {loading ? "Wysyłanie..." : "Wyślij"}
        </button>
      </form>

      {status && <p className="mt-4">{status}</p>}
    </div>
  );
}
