// app/api/places/route.ts
export const runtime = "node"; // o "edge" si prefieres

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q || q.length < 2) return Response.json([]);

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");

  // 👇 Solo resultados de Polonia
  url.searchParams.set("countrycodes", "pl");
  // 👇 Respuestas en polaco
  url.searchParams.set("accept-language", "pl");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "alquiler-app/1.0 (contact@your-domain.com)" },
    cache: "no-store",
  });

  if (!res.ok) return Response.json([]);

  const data: any[] = await res.json();
  const items = data.map((d) => {
    const a = d.address ?? {};
    const city =
      a.city ||
      a.town ||
      a.village ||
      a.municipality ||
      a.county ||
      "";
    const postalCode = a.postcode || "";
    return {
      id: String(d.place_id),
      label: city
        ? `${city}${postalCode ? ` (${postalCode})` : ""}`
        : d.display_name,
      city,
      postalCode,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    };
  });

  return Response.json(items);
}
