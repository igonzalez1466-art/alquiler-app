"use client";

import { useState } from "react";
import ShippingMethodFields from "./ShippingMethodFields";
import { updateReturnAction } from "../_actions/updateReturnAction";

type Props = {
  bookingId: string;
  locked: boolean; // true si zwrot zakończony (CONFIRMED / AUTO_CONFIRMED)
  initial: {
    returnStatus: string;
    returnCarrier: string | null;
    returnTrackingNumber: string | null;
  };
};

export default function ReturnForm({ bookingId, locked, initial }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const disabled = locked || loading;

  return (
    <form
      action={async (formData) => {
        setLoading(true);
        setError("");
        try {
          await updateReturnAction(formData);
        } catch (error) {
          setError(error instanceof Error ? error.message : "Nie udało się zapisać. Spróbuj ponownie.");
        } finally {
          setLoading(false);
        }
      }}
      className="space-y-3"
    >
      <input type="hidden" name="bookingId" value={bookingId} />

      <input type="hidden" name="returnStatus" value="SHIPPED" />
      <ShippingMethodFields
        key={JSON.stringify([initial.returnCarrier, initial.returnTrackingNumber])}
        initialCarrier={initial.returnCarrier}
        initialTracking={initial.returnTrackingNumber}
        trackingName="returnTrackingNumber"
        disabled={disabled}
      />

      <button
        disabled={disabled}
        className="bg-indigo-600 text-white rounded px-4 py-2 disabled:opacity-60"
      >
        {loading ? "Zapisywanie..." : (initial.returnStatus === "SHIPPED" ? "Zapisz dane przesyłki" : "Wysłano")}
      </button>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </form>
  );
}