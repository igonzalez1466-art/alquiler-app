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

type Point = { name: string; address?: unknown };
type GeowidgetApi = { addPointSelectedCallback: (callback: (...values: unknown[]) => void) => void };
const isPointCode = (name: string) => /^[A-Z0-9-]{3,20}$/.test(name) && /\d/.test(name);

function readCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().toUpperCase();
  if (isPointCode(text)) return text;
  return text.match(/\b[A-Z]{2,5}\d+[A-Z]{0,5}\b/g)?.find(isPointCode) ?? null;
}

function findPoint(value: unknown, depth = 0): Point | null {
  if (depth > 4) return null;
  if (typeof value === "string") {
    const name = readCode(value);
    return name ? { name } : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const point = findPoint(item, depth + 1);
      if (point) return point;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;

  const data = value as Record<string, unknown>;
  for (const key of ["detail", "details", "point", "selectedPoint", "data", "payload", "result"]) {
    const point = findPoint(data[key], depth + 1);
    if (point) return point;
  }
  for (const key of ["name", "display_name", "pointName", "point_name", "code", "pointCode"]) {
    const name = readCode(data[key]);
    if (name) return { name, address: data.address ?? data.address_details };
  }
  if (typeof data.href === "string") {
    try {
      const name = readCode(new URL(data.href).pathname.split("/").filter(Boolean).at(-1));
      if (name) return { name, address: data.address ?? data.address_details };
    } catch {
      // An invalid link should not prevent the user from entering a point manually.
    }
  }
  return null;
}

function describeSelection(value: unknown, depth = 0): string {
  if (value === null) return "null";
  if (typeof value !== "object") return typeof value === "string" ? `tekst (${value.length} znaków)` : typeof value;
  if (Array.isArray(value)) return `[${value.slice(0, 2).map(item => describeSelection(item, depth + 1)).join("; ")}]`;
  try {
    const data = value as Record<string, unknown>;
    const keys = Object.keys(data).slice(0, 12).join(", ") || "brak";
    const names = ["name", "display_name", "pointName", "point_name", "code", "pointCode"]
      .filter(key => typeof data[key] === "string")
      .map(key => `${key}: tekst (${(data[key] as string).length} znaków)`);
    const nested = depth < 2
      ? ["detail", "details", "point", "selectedPoint", "data", "payload", "result"]
          .filter(key => data[key] != null)
          .map(key => `${key}: ${describeSelection(data[key], depth + 1)}`)
      : [];
    return `klucze: ${keys}; ${[...names, ...nested].join("; ")}`.slice(0, 500);
  } catch {
    return "Nie można odczytać struktury odpowiedzi.";
  }
}

function readAddress(value: unknown): string {
  if (typeof value === "string") return value.trim().slice(0, 200);
  if (!value || typeof value !== "object") return "";
  const address = value as Record<string, unknown>;
  const parts = address.line1 || address.line2
    ? [address.line1, address.line2]
    : [[address.street, address.building_number].filter(Boolean).join(" "),
      [address.post_code, address.city].filter(Boolean).join(" ")];
  return parts
    .filter((part): part is string => typeof part === "string" && !!part.trim())
    .map(part => part.trim()).join(", ").slice(0, 200);
}

export default function InpostPointPicker({ token, disabled, onSelect }: {
  token: string;
  disabled: boolean;
  onSelect: (code: string, address: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [diagnostic, setDiagnostic] = useState("");
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let accepted = false;
    const target = container.current;
    if (!document.querySelector('link[data-inpost-geowidget="true"]')) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = stylesheetUrl;
      stylesheet.dataset.inpostGeowidget = "true";
      document.head.appendChild(stylesheet);
    }
    const selected = (value: unknown, source: string) => {
      if (accepted) return;
      const point = findPoint(value);
      if (!point) {
        setError("Nie udało się odczytać danych wybranego punktu. Wybierz inny punkt lub wpisz kod ręcznie.");
        setDiagnostic(`${source}: ${describeSelection(value)}`);
        return;
      }
      accepted = true;
      setError("");
      setDiagnostic("");
      onSelect(point.name, readAddress(point.address));
      setOpen(false);
    };
    const callbackName = `mojaSzafaInpostPoint${Math.random().toString(36).slice(2)}`;
    (window as unknown as Record<string, unknown>)[callbackName] = (value: unknown) => {
      if (active) selected(value, "onpoint");
    };
    void loadWidget().then(() => {
      if (!active || !target) return;
      const widget = document.createElement("inpost-geowidget");
      widget.addEventListener("inpost.geowidget.init", (event) => {
        const api = (event as CustomEvent<{ api?: GeowidgetApi }>).detail?.api;
        if (typeof api?.addPointSelectedCallback !== "function") {
          setError("Nie udało się połączyć mapy z formularzem. Możesz wpisać kod punktu ręcznie.");
          return;
        }
        api.addPointSelectedCallback((...values) => { if (active) selected(values, "api"); });
      });
      widget.setAttribute("token", token);
      widget.setAttribute("config", "parcelCollect");
      widget.setAttribute("country", "PL");
      widget.setAttribute("language", "pl");
      widget.setAttribute("onpoint", callbackName);
      widget.style.display = "block";
      widget.style.width = "100%";
      widget.style.height = "min(70vh, 560px)";
      target.replaceChildren(widget);
    }).catch(() => {
      if (active) setError("Mapa InPost jest chwilowo niedostępna. Możesz wpisać kod punktu ręcznie.");
    });
    return () => {
      active = false;
      delete (window as unknown as Record<string, unknown>)[callbackName];
      target?.replaceChildren();
    };
  }, [open, token, onSelect]);

  return <div className="space-y-2">
    <button type="button" disabled={disabled} onClick={() => { setError(""); setDiagnostic(""); setOpen(value => !value); }} className="rounded border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-60">
      {open ? "Zamknij mapę punktów" : "Wybierz punkt z mapy InPost"}
    </button>
    {open && <div ref={container} className="min-h-72 overflow-hidden rounded border bg-gray-50" aria-label="Mapa punktów InPost"><p className="p-3 text-sm text-gray-600">Wczytywanie mapy InPost…</p></div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {diagnostic && <details className="text-xs text-gray-600"><summary className="cursor-pointer">Dane diagnostyczne (bez tokenu)</summary><code className="break-all">{diagnostic}</code></details>}
  </div>;
}
