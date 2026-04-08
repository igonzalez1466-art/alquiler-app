"use client";

import { useMemo, useState } from "react";
import {
  releaseDepositAction,
  partialReleaseDepositAction,
  retainDepositAction,
} from "../_actions/depositActions";

type Mode = "refund" | "partial" | "retain";

type RetentionReasonCode =
  | "DAMAGE"
  | "STAINING"
  | "MISSING_ITEM"
  | "LATE_RETURN"
  | "CLEANING"
  | "OTHER";

const RETENTION_REASON_OPTIONS: { value: RetentionReasonCode; label: string }[] =
  [
    { value: "DAMAGE", label: "Uszkodzenie" },
    { value: "STAINING", label: "Zabrudzenie" },
    { value: "MISSING_ITEM", label: "Brak elementu" },
    { value: "LATE_RETURN", label: "Opóźniony zwrot" },
    { value: "CLEANING", label: "Koszt czyszczenia" },
    { value: "OTHER", label: "Inny powód" },
  ];

export default function DepositActions({
  bookingId,
  depositZl,
}: {
  bookingId: string;
  depositZl: number;
}) {
  const [mode, setMode] = useState<Mode>("refund");
  const [loading, setLoading] = useState(false);

  // Guardamos string para evitar efectos raros tipo 05 en el input controlado
  const [amountInput, setAmountInput] = useState<string>(
    String(Math.max(depositZl - 1, 1))
  );

  const [reasonCode, setReasonCode] =
    useState<RetentionReasonCode>("DAMAGE");
  const [reason, setReason] = useState("");

  const safeAmount = useMemo(() => {
    const parsed = parseInt(amountInput || "0", 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(Math.max(parsed, 0), depositZl);
  }, [amountInput, depositZl]);

  const retained = depositZl - safeAmount;

  const reasonRequired = mode === "partial" || mode === "retain";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900">Kaucja</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Zarządzaj zwrotem lub zatrzymaniem kaucji po potwierdzeniu zwrotu.
          </p>
        </div>

        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          Opłacona
        </span>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-zinc-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Kaucja pobrana
          </div>
          <div className="mt-2 text-lg font-semibold text-zinc-900">
            {depositZl} zł
          </div>
        </div>

        <div className="rounded-xl bg-zinc-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Zwrócono
          </div>
          <div className="mt-2 text-lg font-semibold text-zinc-900">0 zł</div>
        </div>

        <div className="rounded-xl bg-zinc-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Zatrzymano
          </div>
          <div className="mt-2 text-lg font-semibold text-zinc-900">0 zł</div>
        </div>
      </div>

      <div className="mb-5">
        <div className="inline-flex rounded-xl bg-zinc-100 p-1">
          <button
            type="button"
            onClick={() => setMode("refund")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === "refund"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Zwróć całość
          </button>

          <button
            type="button"
            onClick={() => setMode("partial")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === "partial"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Zwróć część
          </button>

          <button
            type="button"
            onClick={() => setMode("retain")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === "retain"
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Zatrzymaj całość
          </button>
        </div>
      </div>

      {mode === "refund" && (
        <form
          action={async (formData) => {
            try {
              setLoading(true);
              await releaseDepositAction(formData);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <input type="hidden" name="bookingId" value={bookingId} />

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-sm font-medium text-emerald-800">
              Zostanie zwrócona pełna kaucja
            </div>
            <div className="mt-1 text-sm text-emerald-700">
              Kwota zwrotu: <span className="font-semibold">{depositZl} zł</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Przetwarzanie..." : "Zwróć całość"}
          </button>
        </form>
      )}

      {mode === "partial" && (
        <form
          action={async (formData) => {
            try {
              setLoading(true);
              await partialReleaseDepositAction(formData);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <input type="hidden" name="bookingId" value={bookingId} />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="refundAmountZl"
                className="mb-1.5 block text-sm font-medium text-zinc-700"
              >
                Kwota zwrotu
              </label>
              <input
                id="refundAmountZl"
                name="refundAmountZl"
                type="number"
                min={0}
                max={depositZl}
                step="1"
                inputMode="numeric"
                value={amountInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setAmountInput("");
                    return;
                  }
                  const normalized = raw.replace(/^0+(?=\d)/, "");
                  setAmountInput(normalized);
                }}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Wpisz kwotę, która ma zostać zwrócona najemcy.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600">Zwrot dla najemcy</span>
                <span className="font-semibold text-zinc-900">
                  {safeAmount} zł
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-zinc-600">
                  Zatrzymane przez właściciela
                </span>
                <span className="font-semibold text-zinc-900">
                  {retained} zł
                </span>
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="reasonCode-partial"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Powód zatrzymania części kaucji
            </label>
            <select
              id="reasonCode-partial"
              name="reasonCode"
              value={reasonCode}
              onChange={(e) =>
                setReasonCode(e.target.value as RetentionReasonCode)
              }
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
              required={reasonRequired}
            >
              {RETENTION_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="reason-partial"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Szczegóły
            </label>
            <textarea
              id="reason-partial"
              name="reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Opisz powód potrącenia, np. uszkodzenie, zabrudzenie, brak elementu..."
              required={reasonRequired}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Przetwarzanie..." : "Zwróć część"}
          </button>
        </form>
      )}

      {mode === "retain" && (
        <form
          action={async (formData) => {
            try {
              setLoading(true);
              await retainDepositAction(formData);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <input type="hidden" name="bookingId" value={bookingId} />

          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="text-sm font-medium text-rose-800">
              Cała kaucja zostanie zatrzymana
            </div>
            <div className="mt-1 text-sm text-rose-700">
              Zatrzymana kwota: <span className="font-semibold">{depositZl} zł</span>
            </div>
          </div>

          <div>
            <label
              htmlFor="reasonCode-retain"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Powód zatrzymania kaucji
            </label>
            <select
              id="reasonCode-retain"
              name="reasonCode"
              value={reasonCode}
              onChange={(e) =>
                setReasonCode(e.target.value as RetentionReasonCode)
              }
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
              required={reasonRequired}
            >
              {RETENTION_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="reason-retain"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Szczegóły
            </label>
            <textarea
              id="reason-retain"
              name="reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Wyjaśnij, dlaczego kaucja została zatrzymana..."
              required={reasonRequired}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Przetwarzanie..." : "Zatrzymaj całość"}
          </button>
        </form>
      )}
    </section>
  );
}