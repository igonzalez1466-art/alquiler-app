"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@/app/leaflet-fix.css";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

// ✅ Leaflet icon fix (SIN any)
const iconProto = L.Icon.Default.prototype as unknown as {
  _getIconUrl?: () => string;
};

if (iconProto._getIconUrl) {
  delete iconProto._getIconUrl;
}

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

type MarkerData = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  pricePerDay?: number;
  city?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
};

function FitToMarkers({ markers }: { markers: MarkerData[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || markers.length === 0) return;

    if (markers.length === 1) {
      const { lat, lng } = markers[0];
      map.setView([lat, lng], 14, { animate: true });
      return;
    }

    const bounds = L.latLngBounds(
      markers.map((m) => [m.lat, m.lng] as [number, number])
    );
    if (!bounds.isValid()) return;

    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, markers]);

  return null;
}

/**
 * Separa markers que tienen las MISMAS coordenadas (o casi iguales)
 * para que no se pisen y puedas clickar todos.
 */
function spreadOverlappingMarkers(markers: MarkerData[]) {
  const groups = new Map<string, MarkerData[]>();

  for (const m of markers) {
    const key = `${m.lat.toFixed(6)},${m.lng.toFixed(6)}`;
    const arr = groups.get(key) ?? [];
    arr.push(m);
    groups.set(key, arr);
  }

  const R = 0.00018; // ~15-25m aprox
  const out: MarkerData[] = [];

  for (const arr of groups.values()) {
    if (arr.length === 1) {
      out.push(arr[0]);
      continue;
    }

    arr.forEach((m, idx) => {
      const angle = (2 * Math.PI * idx) / arr.length;
      out.push({
        ...m,
        lat: m.lat + R * Math.cos(angle),
        lng: m.lng + R * Math.sin(angle),
      });
    });
  }

  return out;
}

export default function ListingMap({ markers }: { markers: MarkerData[] }) {
  const router = useRouter();

  const spreadMarkers = useMemo(
    () => spreadOverlappingMarkers(markers),
    [markers]
  );

  const DEFAULT_CENTER: [number, number] = [52.2297, 21.0122]; // Warszawa
  const center: [number, number] = spreadMarkers.length
    ? [spreadMarkers[0].lat, spreadMarkers[0].lng]
    : DEFAULT_CENTER;

  const zoom = spreadMarkers.length ? 10 : 6;

  return (
    <div className="relative z-0 w-full h-72 rounded overflow-hidden border bg-gray-100">
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitToMarkers markers={spreadMarkers} />

        {spreadMarkers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]}>
            <Popup className="p-0">
              <div className="w-52 md:w-64 rounded-lg bg-white shadow-md overflow-hidden border border-gray-200">
                {m.imageUrl && (
                  <div className="h-24 w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.imageUrl}
                      alt={m.imageAlt ?? m.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div className="p-2.5 space-y-1">
                  <div className="font-semibold text-sm leading-tight line-clamp-2">
                    {m.title}
                  </div>

                  {m.city && (
                    <div className="text-xs text-gray-600">{m.city}</div>
                  )}

                  <button
                    onClick={() => router.push(`/listing/${m.id}`)}
                    className="mt-2 w-full bg-indigo-600 text-white text-xs md:text-sm font-medium px-3 py-1.5 rounded-md hover:bg-indigo-700 transition"
                  >
                    Zobacz
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
