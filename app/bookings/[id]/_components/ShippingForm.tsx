"use client";
import { userMessage } from "@/app/lib/userMessage";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { announceBookingAction } from "@/app/lib/bookingActionFeedback";
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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const submitting = useRef(false);

  const isLocked = sent || !!initial.shippedAt || !["PENDING", "READY"].includes(initial.shippingStatus);
  if (isLocked) {
    return <p className="text-sm text-gray-600">Dostawa została oznaczona jako „Wysłano”. Dane przesyłki są zablokowane.</p>;
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (isLocked || submitting.current) return;
        const formData = new FormData(event.currentTarget);
        submitting.current = true;
        setLoading(true);
        setError("");
        void (async () => {
          try {
            await updateShippingAction(formData);
            setSent(true);
            announceBookingAction(bookingId, "Dostawa została oznaczona jako wysłana. Teraz najemca potwierdza odbiór.");
            router.refresh();
          } catch (cause) {
            setError(userMessage(cause, "Nie udało się zapisać. Spróbuj ponownie."));
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
        disabled={loading}
      />

      {/* ===== Button / Info ===== */}
      <div className="space-y-1">
        <button
          type="submit"
          disabled={loading}
          className="ui-btn ui-btn-primary w-full sm:w-auto disabled:cursor-wait whitespace-nowrap"
        >
          {loading && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {loading ? "Zapisywanie..." : "Wysłano / Przekazano"}
        </button>

        {loading && <p role="status" aria-live="polite" className="text-sm text-gray-600">Zapisywanie danych dostawy…</p>}
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </form>
  );
}
