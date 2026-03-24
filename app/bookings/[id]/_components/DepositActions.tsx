"use client";

import { useState } from "react";
import { releaseDepositAction, retainDepositAction } from "../_actions/depositActions";

type Props = {
  bookingId: string;
};

export default function DepositActions({ bookingId }: Props) {
  const [loading, setLoading] = useState<null | "refund" | "retain">(null);

  return (
    <div className="space-y-3">
      <form
        action={async (formData) => {
          setLoading("refund");
          try {
            await releaseDepositAction(formData);
          } finally {
            setLoading(null);
          }
        }}
      >
        <input type="hidden" name="bookingId" value={bookingId} />
        <button
          disabled={loading !== null}
          className="bg-emerald-600 text-white rounded px-4 py-2 disabled:opacity-60"
        >
          {loading === "refund" ? "Przetwarzanie..." : "Zwróć całą kaucję"}
        </button>
      </form>

      <form
        action={async (formData) => {
          setLoading("retain");
          try {
            await retainDepositAction(formData);
          } finally {
            setLoading(null);
          }
        }}
      >
        <input type="hidden" name="bookingId" value={bookingId} />
        <button
          disabled={loading !== null}
          className="bg-rose-600 text-white rounded px-4 py-2 disabled:opacity-60"
        >
          {loading === "retain" ? "Zapisywanie..." : "Zatrzymaj kaucję"}
        </button>
      </form>
    </div>
  );
}