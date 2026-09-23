"use client";

import Link from "next/link";
import { useState } from "react";

export default function BookingDetailsLink({ bookingId }: { bookingId: string }) {
  const [opening, setOpening] = useState(false);

  return <Link
    href={`/bookings/${bookingId}`}
    aria-busy={opening}
    aria-disabled={opening}
    onClick={event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      if (opening) {
        event.preventDefault();
        return;
      }
      setOpening(true);
    }}
    className="inline-flex w-full items-center justify-center gap-2 rounded border px-3 py-2 text-center text-gray-700 hover:bg-gray-50 sm:w-auto sm:py-1"
  >
    {opening && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />}
    {opening ? "Otwieranie…" : "Zobacz szczegóły"}
  </Link>;
}
