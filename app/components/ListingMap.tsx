"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// 🔹 Fix iconos Leaflet (SIN any)
const iconProto = L.Icon.Default.prototype as unknown as {
  _getIconUrl?: () => string;
};

if (iconProto._getIconUrl) {
  delete iconProto._getIconUrl;
}

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

/* ===================== TYPES ===================== */
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

/* ===================== HELPERS ===================== */
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

    const distance = map.distance(bounds.getNorthEast(), bounds.getSouthWest());

    if (distance < 1000) {
      const c = bounds.getCenter();
      map.setView([c.lat, c.lng], 15, { animate: true });
      return;
    }

    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, markers]);

  return null;
}

/* ===================== COMPONENT ===================== */
export default function ListingMap({ markers }: { markers: MarkerData[] }) {
  const router = useRouter();

  const center: [number, number] = markers.length
    ? [markers[0].lat, markers[0].lng]
    : [52.2297, 21.0122];

  return (
    <div className="relative z-0 w-full h-72 rounded overflow-hidden border bg-gray-100">
      <MapContainer
        center={center}
        zoom={6}
        className="w-full h-full"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitToMarkers markers={markers} />

        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]}>
            <Popup className="p-0">
              <div className="w-52 md:w-64 rounded-lg bg-white shadow-md overflow-hidden border border-gray-200">
                {m.imageUrl && (
                  <div className="relative h-24 w-full overflow-hidden">
                    <Image
                      src={m.imageUrl}
                      alt={m.imageAlt ?? m.title}
                      fill
                      sizes="256px"
                      className="object-cover"
                    />
                  </div>
                )}

                <div className="p-2.5 space-y-1">
                  <div className="font-semibold text-sm leading-tight line-clamp-2">
                    {m.title}
                  </div>

                  {m.city && <div className="text-xs text-gray-600">{m.city}</div>}

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
