// Transport information only: never update receipt, payment or deposit state here.
const labels: Record<string, string> = {
  created: "Przesyłka utworzona",
  confirmed: "Przesyłka przygotowana do nadania",
  dispatched_by_sender: "Przesyłka nadana",
  collected_from_sender: "Przesyłka odebrana od nadawcy",
  taken_by_courier: "Przesyłka odebrana przez kuriera",
  adopted_at_source_branch: "Przesyłka w oddziale nadawczym",
  sent_from_source_branch: "Przesyłka w drodze",
  adopted_at_sorting_center: "Przesyłka w sortowni",
  sent_from_sorting_center: "Przesyłka w drodze",
  adopted_at_target_branch: "Przesyłka w oddziale docelowym",
  out_for_delivery: "Przesyłka w doręczeniu",
  ready_to_pickup: "Przesyłka gotowa do odbioru",
  pickup_reminder_sent: "Przesyłka oczekuje na odbiór",
  delivered: "Przesyłka odebrana / doręczona",
  returned_to_sender: "Przesyłka zwrócona nadawcy",
  avizo: "Próba doręczenia",
  canceled: "Przesyłka anulowana",
  cancelled: "Przesyłka anulowana",
};

export function isInpost(carrier: string | null) {
  return /^(inpost|inpost paczkomat[y]?|paczkomat[y]? inpost|inpost kurier|kurier inpost)$/i.test(carrier?.trim().replace(/\s+/g, " ") ?? "");
}

export function normalizeInpostNumber(value: string | null): string | null {
  const number = value?.replace(/\s/g, "") ?? "";
  return /^\d{24}$/.test(number) ? number : null;
}

export type TrackingResult =
  | { kind: "ok"; label: string; updatedAt: string | null; checkedAt: string; events: { label: string; occurredAt: string }[] }
  | { kind: "missing" | "unavailable" };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trackingEvents(value: unknown): { label: string; occurredAt: string }[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((entry: unknown) => {
    if (!record(entry) || typeof entry.status !== "string" ||
        typeof entry.datetime !== "string" || !Number.isFinite(Date.parse(entry.datetime))) return [];
    return [{
      label: Object.hasOwn(labels, entry.status) ? labels[entry.status] : "Inny status InPost",
      occurredAt: new Date(entry.datetime).toISOString(),
    }];
  });
}

export async function fetchInpostTracking(number: string): Promise<TrackingResult> {
  if (!/^\d{24}$/.test(number)) return { kind: "missing" };
  try {
    const response = await fetch("https://api-shipx-pl.easypack24.net/v1/tracking/" + number, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
      redirect: "error",
    });
    if (response.status === 404 || response.status === 400) return { kind: "missing" };
    if (!response.ok) return { kind: "unavailable" };
    const data: unknown = await response.json();
    if (!record(data) || data.tracking_number !== number || typeof data.status !== "string") {
      return { kind: "unavailable" };
    }
    const updatedAt = typeof data.updated_at === "string" && Number.isFinite(Date.parse(data.updated_at))
      ? new Date(data.updated_at).toISOString() : null;
    return {
      kind: "ok",
      label: Object.hasOwn(labels, data.status) ? labels[data.status] : "Sprawdź szczegóły na stronie InPost",
      updatedAt,
      checkedAt: new Date().toISOString(),
      events: trackingEvents(data.tracking_details),
    };
  } catch {
    return { kind: "unavailable" };
  }
}
