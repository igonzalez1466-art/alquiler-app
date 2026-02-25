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
        setError(err.message ?? "Error creando el pago");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [bookingId]);

  if (loading) return <p>Cargando pago…</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!data) return <p>No se pudieron cargar los datos de pago.</p>;

  const formatMoney = (cents: number) =>
    new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: data.currency.toUpperCase(),
    }).format(cents / 100);

  return (
    <div className="p-6 space-y-6 max-w-lg">
      <h1 className="text-xl font-semibold">Pagar reserva</h1>

      {/* ✅ RESUMEN CON IMPORTES */}
      <div className="bg-gray-50 border rounded-lg p-4 text-sm space-y-2">
        <p>
          ✔ <strong>Alquiler:</strong>{" "}
          {formatMoney(data.rentAmountCents)} (se cobra ahora)
        </p>
        <p>
          🧊 <strong>Fianza:</strong>{" "}
          {formatMoney(data.depositAmountCents)} (solo se bloquea)
        </p>
        <p className="text-gray-500 text-xs">
          Total hoy: {formatMoney(data.rentAmountCents)}
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