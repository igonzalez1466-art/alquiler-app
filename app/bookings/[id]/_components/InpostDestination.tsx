"use client";

import { useCallback, useRef, useState } from "react";
import InpostPointPicker from "@/app/account/InpostPointPicker";
import { lookupBookingInpostPointAddressAction, updateInpostPointAction } from "../_actions/updateInpostPointAction";

type Props = {
  bookingId: string;
  stage: "DELIVERY" | "RETURN";
  isRecipient: boolean;
  locked: boolean;
  code: string | null;
  address: string | null;
  preferredCode: string | null;
  preferredAddress: string | null;
  geowidgetToken: string | null;
  recipient: { name: string | null; email: string | null; phone: string | null };
};

export default function InpostDestination({ bookingId, stage, isRecipient, locked, code, address, preferredCode, preferredAddress, geowidgetToken, recipient }: Props) {
  const [saving, setSaving] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [pointCode, setPointCode] = useState(code ?? preferredCode ?? "");
  const [pointAddress, setPointAddress] = useState(address ?? preferredAddress ?? "");
  const [savedPoint, setSavedPoint] = useState<{ code: string; address: string | null } | null>(null);
  const selection = useRef(0);
  const title = stage === "DELIVERY" ? "Punkt InPost do dostawy" : "Punkt InPost do zwrotu";
  const savedCode = savedPoint?.code ?? code;
  const savedAddress = savedPoint?.address ?? address;
  const contact = stage === "DELIVERY" ? "właścicielem" : "najemcą";
  const showForm = isRecipient && !locked && (!savedCode || editing);

  const selectPoint = useCallback((selectedCode: string, selectedAddress: string) => {
    const currentSelection = ++selection.current;
    setPointCode(selectedCode);
    setPointAddress(selectedAddress);
    setLoadingAddress(false);
    setError("");
    if (selectedAddress) return;
    setLoadingAddress(true);
    void lookupBookingInpostPointAddressAction(selectedCode).then(foundAddress => {
      if (selection.current !== currentSelection) return;
      setPointAddress(foundAddress ?? "");
      if (!foundAddress) setError("Nie udało się pobrać adresu punktu InPost. Kod możesz nadal zapisać.");
    }).catch(() => {
      if (selection.current === currentSelection) setError("Nie udało się pobrać adresu punktu InPost. Kod możesz nadal zapisać.");
    }).finally(() => {
      if (selection.current === currentSelection) setLoadingAddress(false);
    });
  }, []);

  return <div className="rounded border border-indigo-200 bg-indigo-50/50 p-3 space-y-2 text-sm">
    <h3 className="font-semibold">{title}</h3>
    <p className="text-gray-600">Punkt z profilu jest przypisywany automatycznie po opłaceniu rezerwacji. Możesz go zmienić tutaj przed wysyłką.</p>
    {savedCode ? <p><strong>{savedCode}</strong>{savedAddress ? ` — ${savedAddress}` : ""}</p> : <p className="text-amber-900">Nie ma jeszcze punktu InPost dla tej rezerwacji. Odbiorca może go dodać poniżej.</p>}

    {isRecipient && !locked && savedCode && !editing && <button type="button" onClick={() => { setPointCode(savedCode); setPointAddress(savedAddress ?? ""); setError(""); setEditing(true); }} className="rounded border border-indigo-300 bg-white px-3 py-2 font-semibold text-indigo-700">Zmień punkt w tej rezerwacji</button>}

    {showForm && <form action={async (formData) => {
      if (saving || loadingAddress) return;
      setSaving(true);
      setError("");
      try {
        const savedAddressValue = await updateInpostPointAction(formData);
        setSavedPoint({
          code: String(formData.get("pointCode") ?? "").trim().toUpperCase(),
          address: savedAddressValue,
        });
        setEditing(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Nie udało się zapisać punktu.");
      } finally {
        setSaving(false);
      }
    }} className="space-y-2 pt-1">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="stage" value={stage} />
      <p className="text-gray-600">Wybierz punkt dla tej rezerwacji. Zmiana nie wpływa na punkt zapisany w profilu.</p>
      {geowidgetToken && <>
        <InpostPointPicker token={geowidgetToken} disabled={saving || loadingAddress} onSelect={selectPoint} />
        <p className="text-xs text-gray-600">Po wybraniu punktu z mapy kod i adres uzupełnią się automatycznie.</p>
      </>}
      <label className="block">Kod punktu
        <input name="pointCode" value={pointCode} onChange={event => { selection.current++; setLoadingAddress(false); setPointCode(event.target.value); setPointAddress(""); setError(""); }} required maxLength={20} disabled={saving} placeholder="np. WAW01M" className="mt-1 w-full rounded border bg-white p-2" />
      </label>
      {loadingAddress && <p role="status" className="text-gray-600">Pobieranie adresu punktu…</p>}
      {pointAddress && <p className="text-gray-700"><span className="font-semibold">Adres punktu:</span> {pointAddress}</p>}
      <input type="hidden" name="pointAddress" value={pointAddress} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving || loadingAddress} className="inline-flex items-center gap-2 rounded bg-indigo-600 px-3 py-2 font-semibold text-white disabled:opacity-60">
          {saving && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {saving ? "Zapisywanie…" : "Zapisz punkt w rezerwacji"}
        </button>
        {savedCode && <button type="button" disabled={saving} onClick={() => { selection.current++; setLoadingAddress(false); setEditing(false); setError(""); }} className="rounded border bg-white px-3 py-2">Anuluj</button>}
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </form>}

    {isRecipient && locked && savedCode && <p className="text-gray-700">Po nadaniu przesyłki punktu nie można zmienić. Jeśli potrzebujesz pomocy, skontaktuj się bezpośrednio z {contact}.</p>}

    {!isRecipient && savedCode && <div className="border-t pt-2 space-y-1">
      <p className="text-gray-600">Dane odbiorcy do przygotowania przesyłki InPost:</p>
      <p>Imię: <strong>{recipient.name || "—"}</strong></p>
      <p>E-mail: <strong>{recipient.email || "—"}</strong></p>
      <p>Telefon: <strong>{recipient.phone || "—"}</strong></p>
    </div>}
    {!isRecipient && !savedCode && <p className="text-gray-600">Poproś odbiorcę o dodanie punktu w rezerwacji przed wysyłką InPost.</p>}
  </div>;
}
