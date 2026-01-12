"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBookingAction } from "./actions";

export default function BookingForm({
  listingId,
  pricePerDay,
  fianza,
  isLoggedIn,
}: {
  listingId: string;
  pricePerDay: number;
  fianza?: number | null;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const getDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    return diff >= 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1 : 0;
  };

  const days = getDays();

  // 🔹 Si no está logueado, redirigimos a NextAuth con callbackUrl
  if (!isLoggedIn) {
    return (
      <button
        type="button"
        onClick={() => {
          const current =
            typeof window !== "undefined"
              ? window.location.href
              : `/listing/${listingId}`; // fallback en SSR
          router.push(
            `/api/auth/signin?callbackUrl=${encodeURIComponent(current)}`
          );
        }}
        className="px-4 py-2 rounded bg-indigo-600 text-white w-full"
      >
        Zaloguj się, aby dokonać rezerwacji
      </button>
    );
  }

  return (
    <form action={createBookingAction} className="space-y-4">
      <input type="hidden" name="listingId" value={listingId} />

      <label className="block">
        Początek
        <input
          type="date"
          name="startDate"
          min={today}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border p-2 rounded w-full"
          required
        />
      </label>

      <label className="block">
        Koniec
        <input
          type="date"
          name="endDate"
          min={startDate || today}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border p-2 rounded w-full"
          required
        />
      </label>

      {/* 👇 Ya no hay cuadro de resumen de precios */}

      <button
        type="submit"
        className="px-4 py-2 rounded bg-indigo-600 text-white w-full"
        disabled={days <= 0}
      >
        Zarezerwuj
      </button>
    </form>
  );
}
