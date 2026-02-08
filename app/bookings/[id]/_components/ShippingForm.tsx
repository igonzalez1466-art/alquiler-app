"use client";

import { useState } from "react";
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

  // 🚫 Bloqueo total si ya está entregado
  const isDelivered = initial.shippingStatus === "DELIVERED";

  return (
    <form
      action={async (formData) => {
        if (isDelivered) return; // doble seguridad
        setLoading(true);
        try {
          await updateShippingAction(formData);
        } finally {
          setLoading(false);
        }
      }}
      className="space-y-4"
    >
      <input type="hidden" name="bookingId" value={bookingId} />

      {/* ===== Status ===== */}
      <div>
        <label className="block text-sm text-gray-600">Status wysyłki</label>
        <select
          name="shippingStatus"
          defaultValue={initial.shippingStatus}
          disabled={isDelivered}
          className="border rounded p-2 w-full disabled:bg-gray-100 disabled:text-gray-500"
        >
          <option value="NOT_REQUIRED">Nie wymaga wysyłki</option>
          <option value="PENDING">Oczekuje na przygotowanie</option>
          <option value="READY">Gotowe do wysyłki</option>
          <option value="SHIPPED">Wysłano</option>
          <option value="DELIVERED">Dostarczono</option>
          <option value="CANCELLED">Anulowano</option>
        </select>
      </div>

      {/* ===== Carrier ===== */}
      <div>
        <label className="block text-sm text-gray-600">Przewoźnik</label>
        <input
          name="carrier"
          defaultValue={initial.carrier ?? ""}
          disabled={isDelivered}
          className="border rounded p-2 w-full disabled:bg-gray-100 disabled:text-gray-500"
          placeholder="np. InPost, DHL"
        />
      </div>

      {/* ===== Tracking ===== */}
      <div>
        <label className="block text-sm text-gray-600">Numer śledzenia</label>
        <input
          name="trackingNumber"
          defaultValue={initial.trackingNumber ?? ""}
          disabled={isDelivered}
          className="border rounded p-2 w-full disabled:bg-gray-100 disabled:text-gray-500"
          placeholder="np. 123456789"
        />
      </div>

      {/* ===== Button / Info ===== */}
      <div className="space-y-1">
        <button
          disabled={loading || isDelivered}
          className="w-full sm:w-auto bg-indigo-600 text-white rounded px-4 py-2 disabled:opacity-60 whitespace-nowrap"
        >
          {loading ? "Zapisywanie..." : "Zapisz szczegóły dostawy"}
        </button>

        {isDelivered && (
          <p className="text-xs text-gray-500">
            Ta wysyłka została oznaczona jako <strong>Dostarczono</strong> —
            dalsze zmiany nie są możliwe.
          </p>
        )}
      </div>
    </form>
  );
}
