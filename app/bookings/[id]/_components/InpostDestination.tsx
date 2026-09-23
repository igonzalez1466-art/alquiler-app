"use client";

import { useState } from "react";
import { updateInpostPointAction } from "../_actions/updateInpostPointAction";

type Props = {
  bookingId: string;
  stage: "DELIVERY" | "RETURN";
  isRecipient: boolean;
  locked: boolean;
  code: string | null;
  address: string | null;
  preferredCode: string | null;
  preferredAddress: string | null;
  recipient: { name: string | null; email: string | null; phone: string | null };
};

export default function InpostDestination({ bookingId, stage, isRecipient, locked, code, address, preferredCode, preferredAddress, recipient }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmedPoint, setConfirmedPoint] = useState<{ code: string; address: string | null } | null>(null);
  const title = stage === "DELIVERY" ? "Punkt InPost do dostawy" : "Punkt InPost do zwrotu";
  const savedCode = confirmedPoint?.code ?? code;
  const savedAddress = confirmedPoint?.address ?? address;
  const contact = stage === "DELIVERY" ? "właścicielem" : "najemcą";

  return <div className="rounded border border-indigo-200 bg-indigo-50/50 p-3 space-y-2 text-sm">
    <h3 className="font-semibold">{title}</h3>
    <p className="text-gray-600">Potrzebny tylko przy wysyłce przez InPost; przy przekazaniu osobistym możesz go pominąć.</p>
    {savedCode ? <p><strong>{savedCode}</strong>{savedAddress ? ` — ${savedAddress}` : ""}</p> : <p className="text-amber-900">Odbiorca nie potwierdził jeszcze punktu InPost dla tej rezerwacji.</p>}

    {isRecipient && !locked && !savedCode && <form action={async (formData) => {
      if (saving) return;
      setSaving(true);
      setError("");
      try {
        await updateInpostPointAction(formData);
        setConfirmedPoint({
          code: String(formData.get("pointCode") ?? "").trim().toUpperCase(),
          address: String(formData.get("pointAddress") ?? "").trim() || null,
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Nie udało się zapisać punktu.");
      } finally {
        setSaving(false);
      }
    }} className="space-y-2 pt-1">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="stage" value={stage} />
      <p className="text-gray-600">Potwierdź punkt dla tej rezerwacji. Możesz wybrać inny niż zapisany w profilu.</p>
      <label className="block">Kod punktu
        <input key={`${stage}-${preferredCode ?? ""}`} name="pointCode" defaultValue={preferredCode ?? ""} required maxLength={20} disabled={saving} placeholder="np. WAW01M" className="mt-1 w-full rounded border bg-white p-2" />
      </label>
      <label className="block">Adres punktu (opcjonalnie)
        <input key={`${stage}-${preferredAddress ?? ""}`} name="pointAddress" defaultValue={preferredAddress ?? ""} maxLength={200} disabled={saving} placeholder="Ulica, miasto" className="mt-1 w-full rounded border bg-white p-2" />
      </label>
      <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded bg-indigo-600 px-3 py-2 font-semibold text-white disabled:opacity-60">
        {saving && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
        {saving ? "Zapisywanie…" : "Potwierdź punkt"}
      </button>
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </form>}

    {isRecipient && savedCode && <p className="text-gray-700">Po potwierdzeniu punktu nie można go zmienić. Jeśli potrzebujesz zmiany, skontaktuj się bezpośrednio z {contact}.</p>}

    {!isRecipient && savedCode && <div className="border-t pt-2 space-y-1">
      <p className="text-gray-600">Dane odbiorcy do przygotowania przesyłki InPost:</p>
      <p>Imię: <strong>{recipient.name || "—"}</strong></p>
      <p>E-mail: <strong>{recipient.email || "—"}</strong></p>
      <p>Telefon: <strong>{recipient.phone || "—"}</strong></p>
    </div>}
    {!isRecipient && !savedCode && <p className="text-gray-600">Poproś odbiorcę o potwierdzenie punktu w rezerwacji przed wysyłką InPost.</p>}
  </div>;
}
