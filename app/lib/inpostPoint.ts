export function readInpostPoint(formData: FormData) {
  const code = String(formData.get("pointCode") ?? "").trim().toUpperCase();
  const address = String(formData.get("pointAddress") ?? "").trim();

  if (!/^[A-Z0-9-]{3,20}$/.test(code)) {
    throw new Error("Podaj poprawny kod punktu InPost (3–20 liter lub cyfr).");
  }
  if (address.length > 200) {
    throw new Error("Adres punktu jest zbyt długi.");
  }

  return { code, address: address || null };
}

export async function fetchInpostPointAddress(code: string): Promise<string | null> {
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) return null;
  try {
    const response = await fetch(`https://api-pl-points.easypack24.net/v1/points/${encodeURIComponent(code)}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return null;
    const point: unknown = await response.json();
    if (!point || typeof point !== "object") return null;
    const data = point as Record<string, unknown>;
    if (data.name !== code) return null;
    const address = data.address;
    if (!address || typeof address !== "object") return null;
    const lines = address as Record<string, unknown>;
    const result = [lines.line1, lines.line2]
      .filter((part): part is string => typeof part === "string" && !!part.trim())
      .map(part => part.trim()).join(", ");
    return result ? result.slice(0, 200) : null;
  } catch {
    return null;
  }
}
