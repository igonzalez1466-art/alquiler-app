"use client";

import { useEffect, useRef, useState } from "react";

type Place = {
  id: string;
  label: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
};

export default function LocationField() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (!query || query.length < 2 || selected?.label === query) {
      setResults([]);
      return;
    }
    timerRef.current = window.setTimeout(async () => {
      controllerRef.current?.abort();
      controllerRef.current = new AbortController();
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(query)}`, {
          signal: controllerRef.current.signal,
        });
        const data: Place[] = await res.json();
        setResults(data);
        setOpen(true);
      } catch {
        /* ignore */
      }
    }, 200);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      controllerRef.current?.abort();
    };
  }, [query, selected?.label]);

  function pick(p: Place) {
    setSelected(p);
    setQuery(p.label);
    setOpen(false);
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-1">
        Lokalizacja (Polska)
      </label>
      <input
        value={query}
        onChange={(e) => {
          setSelected(null);
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() =>
          selected ? setOpen(false) : setOpen(results.length > 0)
        }
        placeholder="Wpisz miasto lub kod pocztowy (tylko Polska)"
        className="border rounded p-2 w-full"
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border bg-white shadow">
          {results.map((r) => (
            <li
              key={r.id}
              className="cursor-pointer px-3 py-2 hover:bg-gray-100"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
            >
              {r.label}
            </li>
          ))}
        </ul>
      )}

      {/* Campos ocultos para el server action */}
      <input type="hidden" name="city" value={selected?.city || ""} />
      <input type="hidden" name="postalCode" value={selected?.postalCode || ""} />
      <input type="hidden" name="lat" value={selected?.lat ?? ""} />
      <input type="hidden" name="lng" value={selected?.lng ?? ""} />
      {/* Opcional: guardar país fijo */}
      <input type="hidden" name="country" value="PL" />
    </div>
  );
}
