"use client";

import { useState } from "react";
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
      <p className="text-sm text-gray-600">Po wysłaniu lub przekazaniu przedmiotu potwierdź wysłanie. Przy odbiorze osobistym pozostaw przewoźnika i numer śledzenia puste.</p>

      <div>
        <label className="block text-sm text-gray-600">
          Przewoźnik (zwrot)
        </label>
        <input
          name="returnCarrier"
          defaultValue={initial.returnCarrier ?? ""}
          className="border rounded p-2 w-full"
          placeholder="np. InPost"
          disabled={disabled}
        />
      </div>

      <div>
        <label className="block text-sm text-gray-600">
          Numer śledzenia (zwrot)
        </label>
        <input
          name="returnTrackingNumber"
          defaultValue={initial.returnTrackingNumber ?? ""}
          className="border rounded p-2 w-full"
          placeholder="np. 123456789"
          disabled={disabled}
        />
      </div>

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