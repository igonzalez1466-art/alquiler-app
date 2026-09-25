"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { prepareBookingPhoto } from "@/app/lib/prepareBookingPhoto";
import { addBookingEvidencePhotosAction } from "../_actions/addBookingEvidencePhotosAction";

type Photo = { id: string; uploaderId: string; createdAt: string };
type Props = { bookingId: string; stage: "DELIVERY" | "RETURN"; userId: string; ownerId: string; renterId: string; canUpload: boolean; photos: Photo[] };

export default function BookingEvidencePhotos({ bookingId, stage, userId, ownerId, renterId, canUpload, photos }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const mine = photos.filter(photo => photo.uploaderId === userId).length;
  const remaining = Math.max(0, 3 - mine);
  const buckets = stage === "DELIVERY" ? [
    { uploaderId: ownerId, title: "Zdjęcia właściciela — przekazanie przedmiotu", role: "właściciel", reportOnly: false },
    { uploaderId: renterId, title: "Zdjęcia najemcy — zgłoszony problem przy odbiorze", role: "najemca", reportOnly: true },
  ] : [
    { uploaderId: renterId, title: "Zdjęcia najemcy — zwrot przedmiotu", role: "najemca", reportOnly: false },
    { uploaderId: ownerId, title: "Zdjęcia właściciela — zgłoszony problem przy zwrocie", role: "właściciel", reportOnly: true },
  ];

  function selectPhotos() {
    setError("");
    input.current?.click();
  }

  function onPhotosChanged(event: React.ChangeEvent<HTMLInputElement>) {
    const names = Array.from(event.currentTarget.files ?? []).map(file => file.name);
    setSelectedNames(names);
    setError(names.length > remaining ? `Wybierz najwyżej ${remaining} zdjęć.` : "");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const files = Array.from(input.current?.files ?? []);
    if (!files.length || files.length > remaining) { setError(`Wybierz od 1 do ${remaining} zdjęć.`); return; }
    setBusy(true); setError(""); setMessage("Przygotowywanie zdjęć…");
    try {
      const data = new FormData();
      data.set("bookingId", bookingId);
      data.set("stage", stage);
      for (const file of files) data.append("photos", await prepareBookingPhoto(file));
      setMessage("Zapisywanie zdjęć…");
      await addBookingEvidencePhotosAction(data);
      if (input.current) input.current.value = "";
      setSelectedNames([]);
      setMessage("Zdjęcia zapisane w rezerwacji.");
      router.refresh();
    } catch (cause) {
      setMessage("");
      setError(cause instanceof Error ? cause.message : "Nie udało się zapisać zdjęć.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-lg border bg-gray-50 p-3 space-y-3" aria-label={stage === "DELIVERY" ? "Zdjęcia dostawy" : "Zdjęcia zwrotu"}>
    <div>
      <h3 className="font-semibold">{stage === "DELIVERY" ? "Zdjęcia dostawy" : "Zdjęcia zwrotu"}</h3>
      <p className="text-xs text-gray-600">Każda strona może dodać maksymalnie 3 zdjęcia na tym etapie. Druga strona zobaczy zdjęcia dopiero po oznaczeniu przesyłki jako „Wysłano”. Zapisanych zdjęć nie można zmienić.</p>
    </div>
    {buckets.map(bucket => {
      const bucketPhotos = photos.filter(photo => photo.uploaderId === bucket.uploaderId);
      return <div key={bucket.uploaderId} className="space-y-2 rounded border bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">{bucket.title}</h4>
          <span className="text-xs text-gray-600">{bucketPhotos.length}/3</span>
        </div>
        {bucket.reportOnly && <p className="text-xs text-gray-600">Przy uszkodzeniu, zabrudzeniu lub brakujących elementach zdjęcia można dołączyć do zgłoszenia problemu. Po wysłaniu zgłoszenia można dodać pozostałe zdjęcia. Potwierdzenie odbioru bez zastrzeżeń zamyka tę możliwość.</p>}
        {bucketPhotos.length > 0 ? <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{bucketPhotos.map(photo => {
      const href = `/api/bookings/${bookingId}/evidence/${photo.id}`;
      return <li key={photo.id} className="overflow-hidden rounded border bg-white">
        <a href={href} target="_blank" rel="noreferrer" className="block" aria-label={`Otwórz zdjęcie: ${bucket.role}, ${new Date(photo.createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}`}>
          <span className="relative block aspect-[4/3]"><Image src={href} alt={`Stan przedmiotu — ${bucket.role}`} fill unoptimized className="object-cover" /></span>
          <span className="block p-2 text-xs">{new Date(photo.createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</span>
        </a>
      </li>;
    })}</ul> : <p className="text-sm text-gray-600">Nie dodano jeszcze zdjęć.</p>}
    {bucket.uploaderId === userId && canUpload && remaining > 0 && <form onSubmit={submit} className="space-y-2">
      <p className="text-sm font-medium">Dodaj zdjęcia (maks. {remaining})</p>
      <input ref={input} id={`evidence-${stage}`} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={onPhotosChanged} className="sr-only" aria-label="Wybierz zdjęcia" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={selectPhotos} disabled={busy} className="rounded border border-indigo-600 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-60">Wybierz zdjęcia</button>
        {selectedNames.length > 0 && <button type="submit" disabled={busy || selectedNames.length > remaining} className="inline-flex items-center gap-2 rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {busy ? "Zapisywanie…" : "Zapisz zdjęcia w rezerwacji"}
        </button>}
      </div>
      {selectedNames.length > 0 && <p className="text-xs text-gray-700" role="status">Wybrano: {selectedNames.join(", ")}</p>}
      <p className="text-xs text-gray-600">Duże zdjęcia zostaną zmniejszone przed wysłaniem.</p>
    </form>}
      </div>;
    })}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </section>;
}
