export function readShippingMethod(formData: FormData, trackingName: string) {
  const method = formData.get("deliveryMethod");
  if (method === "PERSONAL") {
    // Discard any stale tracking when switching from parcel delivery to handover.
    return { carrier: "Odbiór osobisty", trackingNumber: null };
  }
  if (method !== "INPOST") throw new Error("Wybierz sposób przekazania przedmiotu.");
  const trackingNumber = String(formData.get(trackingName) || "").replace(/\s/g, "");
  if (!/^\d{24}$/.test(trackingNumber)) {
    throw new Error("Podaj numer przesyłki InPost składający się z 24 cyfr.");
  }
  return { carrier: "InPost", trackingNumber };
}
