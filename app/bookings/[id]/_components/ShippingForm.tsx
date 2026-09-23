"use client";

import { useRef, useState } from "react";
import ShippingMethodFields from "./ShippingMethodFields";
import { updateShippingAction } from "../_actions/updateShippingAction";

type Props = {
  bookingId: string;
  initial: {
    shippingStatus: string;
    carrier: string | null;
    trackingNumber: string | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
  };
};

export default function ShippingForm({ bookingId, initial }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  // 🚫 Bloqueo total si ya está entregado
  const isDelivered = initial.shippingStatus === "DELIVERED";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (isDelivered || submitting.current) return;
        const formData = new FormData(event.currentTarget);
        submitting.current = true;
        setLoading(true);
        setError("");
        void (async () => {
          try {
            await updateShippingAction(formData);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Nie udało się zapisać. Spróbuj ponownie.");
          } finally {
            submitting.current = false;
            setLoading(false);
          }
        })();
      }}
      className="space-y-4"
    >
      <input type="hidden" name="bookingId" value={bookingId} />

      <input type="hidden" name="shippingStatus" value="SHIPPED" />
      <ShippingMethodFields
        key={JSON.stringify([initial.carrier, initial.trackingNumber])}
        initialCarrier={initial.carrier}
        initialTracking={initial.trackingNumber}
        trackingName="trackingNumber"
        disabled={loading || isDelivered}
      />

      {/* ===== Button / Info ===== */}
      <div className="space-y-1">
        <button
          type="submit"
          disabled={loading || isDelivered}
          className="inline-flex w-full items-center justify-center gap-2 sm:w-auto bg-indigo-600 text-white rounded px-4 py-2 disabled:cursor-wait disabled:opacity-60 whitespace-nowrap"
        >
          {loading && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {loading ? "Zapisywanie..." : (initial.shippingStatus === "SHIPPED" ? "Zapisz dane przesyłki" : "Wysłano")}
        </button>

        {isDelivered && (
          <p className="text-xs text-gray-500">
            Ta wysyłka została oznaczona jako <strong>Dostarczono</strong> —
            dalsze zmiany nie są możliwe.
          </p>
        )}
        {loading && <p role="status" aria-live="polite" className="text-sm text-gray-600">Zapisywanie danych dostawy…</p>}
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </form>
  );
}
