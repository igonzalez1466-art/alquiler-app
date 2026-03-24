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

  // normalización por si existe algún valor legacy en BD
  const defaultStatus =
    initial.returnStatus === "RETURN_PENDING"
      ? "PENDING"
      : initial.returnStatus === "RETURNED"
      ? "DELIVERED"
      : initial.returnStatus;

  const disabled = locked || loading;

  return (
    <form
      action={async (formData) => {
        setLoading(true);
        try {
          await updateReturnAction(formData);
        } finally {
          setLoading(false);
        }
      }}
      className="space-y-3"
    >
      <input type="hidden" name="bookingId" value={bookingId} />

      <div>
        <label className="block text-sm text-gray-600">Status zwrotu</label>

        <select
          name="returnStatus"
          defaultValue={defaultStatus}
          className="border rounded p-2 w-full"
          disabled={disabled}
        >
          <option value="PENDING">Zwrot: oczekuje</option>
          <option value="READY">Zwrot: przygotowany</option>
          <option value="SHIPPED">Zwrot: wysłany</option>
          <option value="DELIVERED">Zwrot: dostarczony</option>
          <option value="LOST">Zaginął / uszkodzony</option>
          <option value="CANCELLED">Anulowano</option>
        </select>

        {locked && (
          <p className="text-xs text-gray-500 mt-1">
            Zwrot zakończony — edycja zablokowana.
          </p>
        )}
      </div>

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
        {loading ? "Zapisywanie..." : "Zapisz zwrot"}
      </button>
    </form>
  );
}