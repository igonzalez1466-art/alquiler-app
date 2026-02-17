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
  const [secrets, setSecrets] = useState<{
    rentClientSecret: string;
    depositClientSecret: string;
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

        const data = await res.json();
        setSecrets({
          rentClientSecret: data.rentClientSecret,
          depositClientSecret: data.depositClientSecret,
        });
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
  if (!secrets) return <p>No se pudieron cargar los datos de pago.</p>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Pagar reserva</h1>

      <div className="text-sm text-gray-700">
        <p>✔ Alquiler: se cobra ahora</p>
        <p>🧊 Fianza: se bloquea, no se cobra</p>
      </div>

      <PayForm
        rentClientSecret={secrets.rentClientSecret}
        depositClientSecret={secrets.depositClientSecret}
      />
    </div>
  );
}
