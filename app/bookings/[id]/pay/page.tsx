"use client";

import { use, useEffect, useState } from "react";
import PayForm from "./PayForm";

export default function PayBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: bookingId } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    rentClientSecret: string;
    depositClientSecret: string;
    currency: string;
    rentAmountCents: number;
    depositAmountCents: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/stripe/create-intents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        });

        if (!res.ok) throw new Error(await res.text());

        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message ?? "Wystąpił błąd podczas tworzenia płatności");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [bookingId]);

  if (loading) return <p>Trwa ładowanie płatności……</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!data) return <p>Nie udało się załadować danych płatności..</p>;

  const formatMoney = (cents: number) =>
    new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: data.currency.toUpperCase(),
    }).format(cents / 100);

  return (
    <div className="p-6 space-y-6 max-w-lg">
      <h1 className="text-xl font-semibold">Opłać rezerwację</h1>

      {/* ✅ RESUMEN CON IMPORTES */}
      <div className="bg-gray-50 border rounded-lg p-4 text-sm space-y-2">
        <p>
          ✔ <strong>Wynajem:</strong>{" "}
          {formatMoney(data.rentAmountCents)} (płatność teraz)
        </p>
        <p>
          🧊 <strong>Kaucja:</strong>{" "}
          {formatMoney(data.depositAmountCents)} (tylko blokada środków)
        </p>
        <p className="text-gray-500 text-xs">
          Do zapłaty teraz: {formatMoney(data.rentAmountCents)}
        </p>
      </div>

      {/* Stripe Form */}
      <PayForm
        rentClientSecret={data.rentClientSecret}
        depositClientSecret={data.depositClientSecret}
      />
    </div>
  );
}