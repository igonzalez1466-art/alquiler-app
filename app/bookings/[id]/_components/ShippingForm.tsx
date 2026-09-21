"use client";

import { useState } from "react";
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

  // 🚫 Bloqueo total si ya está entregado
  const isDelivered = initial.shippingStatus === "DELIVERED";

  return (
    <form
      action={async (formData) => {
        if (isDelivered) return; // doble seguridad
        setLoading(true);
        setError("");
        try {
          await updateShippingAction(formData);
        } catch (error) {
          setError(error instanceof Error ? error.message : "Nie udało się zapisać. Spróbuj ponownie.");
        } finally {
          setLoading(false);
        }
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
          disabled={loading || isDelivered}
          className="w-full sm:w-auto bg-indigo-600 text-white rounded px-4 py-2 disabled:opacity-60 whitespace-nowrap"
        >
          {loading ? "Zapisywanie..." : (initial.shippingStatus === "SHIPPED" ? "Zapisz dane przesyłki" : "Wysłano")}
        </button>

        {isDelivered && (
          <p className="text-xs text-gray-500">
            Ta wysyłka została oznaczona jako <strong>Dostarczono</strong> —
            dalsze zmiany nie są możliwe.
          </p>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </form>
  );
}
