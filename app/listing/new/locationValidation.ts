export const LOCATION_MESSAGE = "Wybierz lokalizację z listy";

export function isValidListingLocation(place: { city: string; lat: number; lng: number } | null) {
  return !!place && !!place.city.trim() && Number.isFinite(place.lat) && Number.isFinite(place.lng) &&
    place.lat >= -90 && place.lat <= 90 && place.lng >= -180 && place.lng <= 180;
}

export function readListingLocation(data: FormData) {
  const city = String(data.get("city") ?? "").trim();
  const latitude = String(data.get("lat") ?? "").trim();
  const longitude = String(data.get("lng") ?? "").trim();
  if (!latitude || !longitude) return null;
  const place = { city, postalCode: String(data.get("postalCode") ?? "").trim(), lat: Number(latitude), lng: Number(longitude) };
  return isValidListingLocation(place) ? place : null;
}
