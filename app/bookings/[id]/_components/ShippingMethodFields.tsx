"use client";

import { useState } from "react";
import { isInpost } from "@/app/lib/inpostTracking";

export default function ShippingMethodFields({ initialCarrier, initialTracking, trackingName, disabled }: {
  initialCarrier: string | null;
  initialTracking: string | null;
  trackingName: string;
  disabled: boolean;
}) {
  const [method, setMethod] = useState(isInpost(initialCarrier) ? "INPOST" :
    initialCarrier === "Odbiór osobisty" ? "PERSONAL" : "");
  const [tracking, setTracking] = useState(isInpost(initialCarrier) ? (initialTracking ?? "").replace(/\s/g, "") : "");

  return <div className="space-y-3">
    <p className="text-sm text-gray-600">Wybierz sposób przekazania przedmiotu. Potwierdź dopiero po wysłaniu lub przekazaniu go osobiście.</p>
    <label className="block text-sm text-gray-600">
      Sposób przekazania
      <select name="deliveryMethod" value={method} onChange={(event) => setMethod(event.target.value)} required disabled={disabled} className="mt-1 border rounded p-2 w-full disabled:bg-gray-100">
        <option value="" disabled>Wybierz sposób przekazania</option>
        <option value="INPOST">InPost</option>
        <option value="PERSONAL">Odbiór osobisty</option>
      </select>
    </label>
    {method === "INPOST" && <div className="space-y-3">
      <div className="rounded border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950 space-y-2">
        <p>Utwórz i opłać etykietę na swoim koncie InPost. Dane odbiorcy i wybrany punkt znajdziesz powyżej w rezerwacji.</p>
        <a href="https://manager.paczkomaty.pl/" target="_blank" rel="noopener noreferrer" className="inline-flex rounded bg-indigo-700 px-3 py-2 font-semibold text-white hover:bg-indigo-800">
          Otwórz InPost i utwórz etykietę ↗
        </a>
        <p>Po faktycznym nadaniu paczki wróć tutaj, wpisz numer z etykiety i potwierdź wysyłkę. Statusy przewozu będą widoczne w szczegółach rezerwacji.</p>
      </div>
      <label className="block text-sm text-gray-600">
        Numer śledzenia InPost (24 cyfry)
        <input name={trackingName} type="text" inputMode="numeric" required pattern="[0-9]{24}" title="Numer przesyłki InPost: 24 cyfry" value={tracking} onChange={(event) => setTracking(event.target.value.replace(/\s/g, ""))} disabled={disabled} className="mt-1 border rounded p-2 w-full disabled:bg-gray-100" placeholder="24-cyfrowy numer przesyłki" />
      </label>
    </div>}
    {method === "PERSONAL" && <p className="text-sm text-gray-600">Przekazanie osobiste — numer śledzenia nie jest potrzebny.</p>}
  </div>;
}
