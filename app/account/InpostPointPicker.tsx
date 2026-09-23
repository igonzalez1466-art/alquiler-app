"use client";

import { useEffect, useRef, useState } from "react";

const widgetUrl = "https://geowidget.inpost-group.com/inpost-geowidget.js";
const stylesheetUrl = "https://geowidget.inpost-group.com/inpost-geowidget.css";
let widgetLoad: Promise<void> | null = null;

function loadWidget() {
  if (customElements.get("inpost-geowidget")) return Promise.resolve();
  if (!widgetLoad) {
    widgetLoad = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = widgetUrl;
      script.async = true;
      script.onload = () => customElements.get("inpost-geowidget") ? resolve() : reject(new Error("Geowidget nie został uruchomiony."));
      script.onerror = () => { script.remove(); reject(new Error("Nie udało się wczytać mapy InPost.")); };
      document.head.appendChild(script);
    }).catch(error => { widgetLoad = null; throw error; });
  }
  return widgetLoad;
}

type Point = { name?: unknown; address?: { line1?: unknown; line2?: unknown } };

export default function InpostPointPicker({ token, disabled, onSelect }: {
  token: string;
  disabled: boolean;
  onSelect: (code: string, address: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const target = container.current;
    if (!document.querySelector('link[data-inpost-geowidget="true"]')) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = stylesheetUrl;
      stylesheet.dataset.inpostGeowidget = "true";
      document.head.appendChild(stylesheet);
    }
    const selected = (event: Event) => {
      const point = (event as CustomEvent<Point>).detail;
      const code = typeof point?.name === "string" ? point.name.trim().toUpperCase() : "";
      const address = [point?.address?.line1, point?.address?.line2]
        .filter((part): part is string => typeof part === "string" && !!part.trim())
        .map(part => part.trim()).join(", ");
      if (!/^[A-Z0-9-]{3,20}$/.test(code) || address.length > 200) {
        setError("Nie udało się odczytać danych wybranego punktu. Wybierz inny punkt lub wpisz kod ręcznie.");
        return;
      }
      onSelect(code, address);
      setOpen(false);
    };
    document.addEventListener("onpointselect", selected);
    void loadWidget().then(() => {
      if (!active || !target) return;
      const widget = document.createElement("inpost-geowidget");
      widget.setAttribute("token", token);
      widget.setAttribute("config", "parcelCollect");
      widget.setAttribute("country", "PL");
      widget.setAttribute("language", "pl");
      widget.setAttribute("onpoint", "onpointselect");
      widget.style.display = "block";
      widget.style.width = "100%";
      widget.style.height = "min(70vh, 560px)";
      target.replaceChildren(widget);
    }).catch(() => {
      if (active) setError("Mapa InPost jest chwilowo niedostępna. Możesz wpisać kod punktu ręcznie.");
    });
    return () => {
      active = false;
      document.removeEventListener("onpointselect", selected);
      target?.replaceChildren();
    };
  }, [open, token, onSelect]);

  return <div className="space-y-2">
    <button type="button" disabled={disabled} onClick={() => { setError(""); setOpen(value => !value); }} className="rounded border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-60">
      {open ? "Zamknij mapę punktów" : "Wybierz punkt z mapy InPost"}
    </button>
    {open && <div ref={container} className="min-h-72 overflow-hidden rounded border bg-gray-50" aria-label="Mapa punktów InPost"><p className="p-3 text-sm text-gray-600">Wczytywanie mapy InPost…</p></div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
