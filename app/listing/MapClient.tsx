"use client";

import dynamic from "next/dynamic";

/* ===== Tipo compartido ===== */
export type MarkerData = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  href?: string;
};

/* ===== Guard de tipo ===== */
function isMarkerData(x: unknown): x is MarkerData {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;

  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.lat === "number" &&
    Number.isFinite(o.lat) &&
    typeof o.lng === "number" &&
    Number.isFinite(o.lng) &&
    (o.href === undefined || typeof o.href === "string")
  );
}

/* ===== Dynamic import tipado ===== */
const ListingMap = dynamic<{ markers: MarkerData[] }>(
  () => import("./components/ListingMap"),
  { ssr: false }
);

/* ===== Wrapper ===== */
export default function MapClient(props: { markers: unknown[] }) {
  // 🔒 Convertimos unknown[] → MarkerData[]
  const markers: MarkerData[] = props.markers.filter(isMarkerData);

  return <ListingMap markers={markers} />;
}
