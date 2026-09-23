"use client";

import { useCallback, useState } from "react";
import { savePreferredInpostPointAction } from "./inpostActions";
import InpostPointPicker from "./InpostPointPicker";

export default function PreferredInpostPointForm({ code, address, geowidgetToken }: { code: string | null; address: string | null; geowidgetToken: string | null }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pointCode, setPointCode] = useState(code ?? "");
  const [pointAddress, setPointAddress] = useState(address ?? "");
  const selectPoint = useCallback((selectedCode: string, selectedAddress: string) => {
    setPointCode(selectedCode);
    setPointAddress(selectedAddress);
    setSaved(false);
    setError("");
  }, []);

  return <form action={async (formData) => {
    if (saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await savePreferredInpostPointAction(formData);
      setSaved(true);
      window.dispatchEvent(new Event("profile-tasks-updated"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się zapisać punktu.");
    } finally {
      setSaving(false);
    }
  }} id="inpost" className="scroll-mt-24 rounded border bg-white p-4 space-y-3">
    <h2 className="text-lg font-semibold">Mój punkt InPost</h2>
    <p className="text-sm text-gray-600">To prywatny punkt domyślny. W każdej opłaconej rezerwacji potwierdzisz punkt osobno.</p>
    {geowidgetToken && <>
      <InpostPointPicker token={geowidgetToken} disabled={saving} onSelect={selectPoint} />
      <p className="text-xs text-gray-600">Po wybraniu punktu z mapy kod i adres uzupełnią się automatycznie. Następnie zapisz punkt.</p>
    </>}
    <label className="block text-sm">Kod punktu
      <input name="pointCode" value={pointCode} onChange={event => { setPointCode(event.target.value); setSaved(false); }} maxLength={20} disabled={saving} placeholder="np. WAW01M" className="mt-1 w-full rounded border p-2" />
    </label>
    <label className="block text-sm">Adres punktu (opcjonalnie)
      <input name="pointAddress" value={pointAddress} onChange={event => { setPointAddress(event.target.value); setSaved(false); }} maxLength={200} disabled={saving} placeholder="Ulica, miasto" className="mt-1 w-full rounded border p-2" />
    </label>
    <p className="text-xs text-gray-500">Aby usunąć punkt domyślny, wyczyść oba pola i zapisz.</p>
    <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
      {saving && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {saving ? "Zapisywanie…" : "Zapisz punkt"}
    </button>
    {saved && <p role="status" className="text-sm text-green-700">Punkt domyślny zapisany.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </form>;
}
