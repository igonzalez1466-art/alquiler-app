"use client";

import { useRef, useState } from "react";
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
  const [sent, setSent] = useState(initial.returnStatus === "SHIPPED");
  const [error, setError] = useState("");
  const submitting = useRef(false);

  const disabled = locked || sent || loading;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || submitting.current) return;
        const formData = new FormData(event.currentTarget);
        submitting.current = true;
        setLoading(true);
        setError("");
        void (async () => {
          try {
            await updateReturnAction(formData);
            setSent(true);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Nie udało się zapisać. Spróbuj ponownie.");
          } finally {
            submitting.current = false;
            setLoading(false);
          }
        })();
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
        type="submit"
        disabled={disabled}
        className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white rounded px-4 py-2 disabled:cursor-wait disabled:opacity-60"
      >
        {loading && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
        {loading ? "Zapisywanie…" : sent ? "Wysłano — oczekuje na potwierdzenie" : "Wysłano"}
      </button>
      {loading && <p role="status" aria-live="polite" className="text-sm text-gray-600">Zapisywanie danych zwrotu…</p>}
      {sent && !loading && <p role="status" className="text-sm text-amber-800">
        Zwrot został oznaczony jako wysłany. Oczekuje na potwierdzenie odbioru przez właściciela.
      </p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </form>
  );
}