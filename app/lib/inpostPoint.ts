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
