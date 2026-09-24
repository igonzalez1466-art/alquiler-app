"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addBookingEvidencePhotosAction } from "../_actions/addBookingEvidencePhotosAction";

type Photo = { id: string; uploaderId: string; createdAt: string };
type Props = { bookingId: string; stage: "DELIVERY" | "RETURN"; userId: string; ownerId: string; canUpload: boolean; photos: Photo[] };

async function preparePhoto(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Wybierz zdjęcia JPG, PNG lub WebP.");
  if (file.size <= 700_000) return file;
  const url = URL.createObjectURL(file);
  const image = new window.Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Nie udało się odczytać zdjęcia."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Nie udało się przygotować zdjęcia.");
    for (const side of [1600, 1280, 1024, 800]) {
      const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.7, 0.58]) {
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("Nie udało się przygotować zdjęcia.")), "image/jpeg", quality));
        if (blob.size <= 700_000) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
    throw new Error("Zdjęcie jest zbyt duże. Wybierz mniejszy plik.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function BookingEvidencePhotos({ bookingId, stage, userId, ownerId, canUpload, photos }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const mine = photos.filter(photo => photo.uploaderId === userId).length;
  const remaining = Math.max(0, 3 - mine);

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
      for (const file of files) data.append("photos", await preparePhoto(file));
      setMessage("Zapisywanie zdjęć…");
      await addBookingEvidencePhotosAction(data);
      if (input.current) input.current.value = "";
      setSelectedNames([]);
      setMessage("Zdjęcia zapisane. Są widoczne dla obu stron rezerwacji.");
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
      <h3 className="font-semibold">Zdjęcia stanu przedmiotu</h3>
      <p className="text-xs text-gray-600">Opcjonalne. Zdjęcia są przypisane do rezerwacji, widoczne tylko dla jej stron i nie można ich zmienić po zapisaniu.</p>
    </div>
    {photos.length > 0 ? <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map(photo => {
      const href = `/api/bookings/${bookingId}/evidence/${photo.id}`;
      const role = photo.uploaderId === ownerId ? "Właściciel" : "Najemca";
      return <li key={photo.id} className="overflow-hidden rounded border bg-white">
        <a href={href} target="_blank" rel="noreferrer" className="block" aria-label={`Otwórz zdjęcie: ${role}, ${new Date(photo.createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}`}>
          <span className="relative block aspect-[4/3]"><Image src={href} alt={`Stan przedmiotu — ${role.toLowerCase()}`} fill unoptimized className="object-cover" /></span>
          <span className="block p-2 text-xs">{role} · {new Date(photo.createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</span>
        </a>
      </li>;
    })}</ul> : <p className="text-sm text-gray-600">Nie dodano jeszcze zdjęć.</p>}
    {canUpload && remaining > 0 && <form onSubmit={submit} className="space-y-2">
      <p className="text-sm font-medium">Dodaj zdjęcia {stage === "DELIVERY" ? "dostawy" : "zwrotu"} (maks. {remaining})</p>
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
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </section>;
}
