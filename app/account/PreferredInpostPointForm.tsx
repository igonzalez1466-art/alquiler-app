"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lookupInpostPointAddressAction, savePreferredInpostPointAction } from "./inpostActions";
import InpostPointPicker from "./InpostPointPicker";

export default function PreferredInpostPointForm({ code, address, geowidgetToken }: { code: string | null; address: string | null; geowidgetToken: string | null }) {
  const [saving, setSaving] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pointCode, setPointCode] = useState(code ?? "");
  const [pointAddress, setPointAddress] = useState(address ?? "");
  const selection = useRef(0);
  const selectPoint = useCallback((selectedCode: string, selectedAddress: string) => {
    const currentSelection = ++selection.current;
    setPointCode(selectedCode);
    setPointAddress(selectedAddress);
    setSaved(false);
    setError("");
    if (selectedAddress) return;
    setLoadingAddress(true);
    void lookupInpostPointAddressAction(selectedCode).then(foundAddress => {
      if (selection.current !== currentSelection) return;
      setPointAddress(foundAddress ?? "");
      if (!foundAddress) setError("Nie udało się pobrać adresu punktu InPost. Kod możesz nadal zapisać.");
    }).catch(() => {
      if (selection.current === currentSelection) setError("Nie udało się pobrać adresu punktu InPost.");
    }).finally(() => {
      if (selection.current === currentSelection) setLoadingAddress(false);
    });
  }, []);

  useEffect(() => {
    if (code && !address) selectPoint(code, "");
  }, [code, address, selectPoint]);

  return <form action={async (formData) => {
    if (saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const savedAddress = await savePreferredInpostPointAction(formData);
      setPointAddress(savedAddress ?? "");
      setSaved(true);
      window.dispatchEvent(new Event("profile-tasks-updated"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się zapisać punktu.");
    } finally {
      setSaving(false);
    }
  }} id="inpost" className="scroll-mt-24 rounded border bg-white p-4 space-y-3">
    <h2 className="text-lg font-semibold">Mój punkt InPost</h2>
    <p className="text-sm text-gray-600">To prywatny punkt domyślny. Po opłaceniu rezerwacji zostanie do niej przypisany automatycznie. Jeśli potrzeba, zmienisz go w szczegółach rezerwacji przed wysyłką.</p>
    {geowidgetToken && <>
      <InpostPointPicker token={geowidgetToken} disabled={saving} onSelect={selectPoint} />
      <p className="text-xs text-gray-600">Po wybraniu punktu z mapy kod uzupełni się automatycznie. Następnie zapisz punkt.</p>
    </>}
    <label className="block text-sm">Kod punktu
      <input name="pointCode" value={pointCode} onChange={event => { selection.current++; setLoadingAddress(false); setPointCode(event.target.value); setPointAddress(""); setSaved(false); }} maxLength={20} disabled={saving} placeholder="np. WAW01M" className="mt-1 w-full rounded border p-2" />
    </label>
    {loadingAddress && <p role="status" className="text-sm text-gray-600">Pobieranie adresu punktu…</p>}
    {pointAddress && <p className="text-sm text-gray-700"><span className="font-semibold">Adres punktu:</span> {pointAddress}</p>}
    <input type="hidden" name="pointAddress" value={pointAddress} />
    <p className="text-xs text-gray-500">Aby usunąć punkt domyślny, wyczyść kod i zapisz.</p>
    <button type="submit" disabled={saving || loadingAddress} className="inline-flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
      {saving && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {saving ? "Zapisywanie…" : "Zapisz punkt"}
    </button>
    {saved && <p role="status" className="text-sm text-green-700">Punkt domyślny zapisany.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </form>;
}
