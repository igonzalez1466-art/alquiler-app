"use client";

import { useState } from "react";
import {
  releaseDepositAction,
  partialReleaseDepositAction,
  retainDepositAction,
} from "../_actions/depositActions";

type Props = {
  bookingId: string;
  depositZl: number;
};

export default function DepositActions({ bookingId, depositZl }: Props) {
  const [loading, setLoading] = useState<null | "refund" | "partial" | "retain">(null);
  const [refundAmountZl, setRefundAmountZl] = useState(
    depositZl > 1 ? depositZl - 1 : 1
  );
  const [partialReason, setPartialReason] = useState("");
  const [retainReason, setRetainReason] = useState("");

  return (
    <div className="space-y-5">
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

      <div className="border rounded p-4 space-y-3">
        <h3 className="font-medium">Częściowy zwrot kaucji</h3>

        <form
          action={async (formData) => {
            setLoading("partial");
            try {
              await partialReleaseDepositAction(formData);
            } finally {
              setLoading(null);
            }
          }}
          className="space-y-3"
        >
          <input type="hidden" name="bookingId" value={bookingId} />

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Kwota do zwrotu (zł)
            </label>
            <input
              type="number"
              name="refundAmountZl"
              min={1}
              max={Math.max(1, depositZl - 1)}
              step={1}
              value={refundAmountZl}
              onChange={(e) => setRefundAmountZl(Number(e.target.value))}
              className="border rounded p-2 w-full sm:w-48"
              disabled={loading !== null}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Powód częściowego zatrzymania
            </label>
            <textarea
              name="reason"
              value={partialReason}
              onChange={(e) => setPartialReason(e.target.value)}
              className="border rounded p-2 w-full"
              rows={3}
              placeholder="np. zabrudzenie wymagające czyszczenia"
              disabled={loading !== null}
              required
            />
          </div>

          <button
            disabled={loading !== null}
            className="bg-amber-600 text-white rounded px-4 py-2 disabled:opacity-60"
          >
            {loading === "partial" ? "Przetwarzanie..." : "Zwróć część kaucji"}
          </button>
        </form>
      </div>

      <div className="border rounded p-4 space-y-3">
        <h3 className="font-medium">Zatrzymaj całą kaucję</h3>

        <form
          action={async (formData) => {
            setLoading("retain");
            try {
              await retainDepositAction(formData);
            } finally {
              setLoading(null);
            }
          }}
          className="space-y-3"
        >
          <input type="hidden" name="bookingId" value={bookingId} />

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Powód zatrzymania
            </label>
            <textarea
              name="reason"
              value={retainReason}
              onChange={(e) => setRetainReason(e.target.value)}
              className="border rounded p-2 w-full"
              rows={3}
              placeholder="np. uszkodzenie materiału"
              disabled={loading !== null}
              required
            />
          </div>

          <button
            disabled={loading !== null}
            className="bg-rose-600 text-white rounded px-4 py-2 disabled:opacity-60"
          >
            {loading === "retain" ? "Zapisywanie..." : "Zatrzymaj kaucję"}
          </button>
        </form>
      </div>
    </div>
  );
}