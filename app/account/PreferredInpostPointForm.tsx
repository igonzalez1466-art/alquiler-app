"use client";
import { userMessage } from "@/app/lib/userMessage";
import { useCallback, useEffect, useRef, useState } from "react";
import { lookupInpostPointAddressAction, savePreferredInpostPointAction } from "./inpostActions";
import InpostPointPicker from "./InpostPointPicker";
import AccountIcon from "./AccountIcon";

export default function PreferredInpostPointForm({ code, address, geowidgetToken }: { code: string | null; address: string | null; geowidgetToken: string | null }) {
  const [editing, setEditing] = useState(!code);
  const [storedPoint, setStoredPoint] = useState({ code: code ?? "", address: address ?? "" });
  const [saving, setSaving] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pointCode, setPointCode] = useState(code ?? "");
  const [pointAddress, setPointAddress] = useState(address ?? "");
  const selection = useRef(0);
  const selectPoint = useCallback((selectedCode: string, selectedAddress: string) => {
    const currentSelection = ++selection.current;
    setPointCode(selectedCode); setPointAddress(selectedAddress); setSaved(false); setError("");
    if (selectedAddress) { setLoadingAddress(false); return; }
    setLoadingAddress(true);
    void lookupInpostPointAddressAction(selectedCode).then(foundAddress => {
      if (selection.current !== currentSelection) return;
      setPointAddress(foundAddress ?? "");
      if (!foundAddress) setError("Nie udało się pobrać adresu punktu InPost. Kod możesz nadal zapisać.");
    }).catch(() => {
      if (selection.current === currentSelection) setError("Nie udało się pobrać adresu punktu InPost.");
    }).finally(() => { if (selection.current === currentSelection) setLoadingAddress(false); });
  }, []);
  useEffect(() => { if (code && !address) selectPoint(code, ""); }, [code, address, selectPoint]);
  function cancelEdit() {
    selection.current++; setPointCode(storedPoint.code); setPointAddress(storedPoint.address); setLoadingAddress(false); setError(""); setEditing(false);
  }
  return <section id="inpost" className="surface-card scroll-mt-24 space-y-4 p-5 sm:p-6" aria-labelledby="delivery-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><AccountIcon name="box" /></span><div><h2 id="delivery-title" className="text-lg font-semibold text-slate-900">Preferencje dostawy</h2><p className="mt-1 text-sm text-slate-500">Twój domyślny punkt InPost.</p></div></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Opcjonalne</span></div>
    {!editing && <>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">{storedPoint.code ? <><p className="text-xs font-medium text-slate-500">Zapisany punkt</p><p className="mt-1 font-semibold text-slate-900">{storedPoint.code}</p>{(storedPoint.address || pointAddress) && <p className="mt-1 text-sm leading-6 text-slate-600">{storedPoint.address || pointAddress}</p>}</> : <p className="text-sm text-slate-600">Nie masz jeszcze zapisanego punktu.</p>}</div>
      <button type="button" onClick={() => { setSaved(false); setEditing(true); }} className="ui-btn"><AccountIcon name="edit" className="h-4 w-4" />{storedPoint.code ? "Zmień punkt" : "Wybierz punkt"}</button>
    </>}
    {editing && <form action={async (formData) => {
      if (saving || loadingAddress) return;
      setSaving(true); setError(""); setSaved(false);
      try {
        const savedAddress = await savePreferredInpostPointAction(formData);
        const savedCode = String(formData.get("pointCode") ?? "").trim().toUpperCase();
        setPointCode(savedCode); setPointAddress(savedAddress ?? ""); setStoredPoint({ code: savedCode, address: savedAddress ?? "" }); setSaved(true); setEditing(false);
        window.dispatchEvent(new Event("profile-tasks-updated"));
      } catch (cause) { setError(userMessage(cause, "Nie udało się zapisać punktu.")); }
      finally { setSaving(false); }
    }} className="space-y-4">
      {geowidgetToken && <InpostPointPicker token={geowidgetToken} disabled={saving} onSelect={selectPoint} />}
      <label className="block text-sm font-medium text-slate-700">Kod punktu<input name="pointCode" value={pointCode} onChange={event => { selection.current++; setLoadingAddress(false); setPointCode(event.target.value); setPointAddress(""); setSaved(false); }} maxLength={20} disabled={saving} placeholder="np. WAW01M" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label>
      {loadingAddress && <p role="status" className="text-sm text-slate-500">Pobieranie adresu punktu…</p>}
      {pointAddress && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><span className="font-medium">Adres punktu:</span> {pointAddress}</p>}
      <input type="hidden" name="pointAddress" value={pointAddress} />
      <p className="text-xs leading-5 text-slate-500">Po wybraniu punktu zapisz zmiany. Aby usunąć punkt domyślny, wyczyść kod i zapisz.</p>
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={saving || loadingAddress} className="ui-btn ui-btn-primary">{saving ? "Zapisywanie…" : "Zapisz punkt"}</button><button type="button" disabled={saving} onClick={cancelEdit} className="ui-btn">Anuluj</button></div>
    </form>}
    <details className="rounded-xl border border-slate-100 p-3 text-sm"><summary className="cursor-pointer font-medium text-slate-600">Kiedy używamy tego punktu?</summary><p className="mt-3 leading-6 text-slate-500">To prywatny punkt domyślny. Po opłaceniu rezerwacji zostanie do niej przypisany automatycznie. Możesz go zmienić w szczegółach rezerwacji przed wysyłką. Odbiór osobisty ustalisz bezpośrednio z drugą stroną.</p></details>
    {saved && <p role="status" className="text-sm text-emerald-700">{storedPoint.code ? "Punkt domyślny zapisany." : "Punkt domyślny usunięty."}</p>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
  </section>;
}
