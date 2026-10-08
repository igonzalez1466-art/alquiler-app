"use client";
import { userMessage } from "@/app/lib/userMessage";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import PayForm from "./PayForm";

export default function PayBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: bookingId } = use(params);

  const [loading, setLoading] = useState(true);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    clientSecret: string;
    currency: string;
    rentAmountCents: number;
    depositAmountCents: number;
    totalAmountCents: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/stripe/create-intents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        });

        if (!res.ok) {
          if (res.headers.get("content-type")?.includes("application/json")) {
            const failure = await res.json();
            if (failure.code === "IDENTITY_REQUIRED") setVerifyUrl(`/account?returnTo=${encodeURIComponent(`/bookings/${bookingId}/pay`)}#tozsamosc`);
            throw new Error(failure.error);
          }
          throw new Error(await res.text());
        }

        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(userMessage(err, "Nie udało się przygotować płatności. Spróbuj ponownie."));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [bookingId]);

  if (loading) return <p>Trwa ładowanie płatności…</p>;
  if (error) return <div className="surface-card max-w-lg p-6 space-y-4"><p role="alert" className="text-rose-700">{error}</p>{verifyUrl && <Link href={verifyUrl} className="ui-btn ui-btn-primary">Zweryfikuj tożsamość</Link>}<Link href={`/bookings/${bookingId}`} className="block underline">Wróć do rezerwacji</Link></div>;
  if (!data) return <p>Nie udało się załadować danych płatności.</p>;

  const formatMoney = (cents: number) =>
    new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: data.currency.toUpperCase(),
    }).format(cents / 100);

  return (
    <div className="p-6 space-y-6 max-w-lg">
      <h1 className="text-xl font-semibold">Opłać rezerwację</h1>

      <div className="bg-gray-50 border rounded-lg p-4 text-sm space-y-2">
        <p>
          ✔ <strong>Wynajem:</strong> {formatMoney(data.rentAmountCents)} (płatność teraz)
        </p>
        {data.depositAmountCents > 0 && <>
          <p>💳 <strong>Kaucja:</strong> {formatMoney(data.depositAmountCents)} (pobierana teraz)</p>
          <p className="text-gray-500 text-xs">Kaucja zostanie zwrócona po prawidłowym zakończeniu wypożyczenia, jeśli nie zostaną zgłoszone szkody.</p>
        </>}
        <p className="text-gray-700 font-medium">
          Do zapłaty teraz: {formatMoney(data.totalAmountCents)}
        </p>
      </div>

      <PayForm clientSecret={data.clientSecret} hasDeposit={data.depositAmountCents > 0} />
    </div>
  );
}
