"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

export default function IncidentPhotoPicker({ required, disabled }: { required: boolean; disabled: boolean }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string; name: string }[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const urls = files.map(file => ({ url: URL.createObjectURL(file), name: file.name }));
    setPreviews(urls);
    return () => urls.forEach(photo => URL.revokeObjectURL(photo.url));
  }, [files]);
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => { setFiles([]); setError(""); input.current?.setCustomValidity(""); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  function recordSelection(control: HTMLInputElement, selected: File[]) {
    const message = selected.length > 3 ? "Możesz wybrać maksymalnie 3 zdjęcia. Usuń niepotrzebne zdjęcia poniżej."
      : selected.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type)) ? "Wybierz zdjęcia w formacie JPG, PNG lub WebP."
      : required && !selected.length ? "Dodaj co najmniej jedno zdjęcie pokazujące problem." : "";
    control.setCustomValidity(message);
    setFiles(selected); setError(message);
  }
  function removePhoto(index: number) {
    if (disabled || !input.current) return;
    const selected = files.filter((_, i) => i !== index);
    try {
      const transfer = new DataTransfer();
      selected.forEach(file => transfer.items.add(file));
      input.current.files = transfer.files;
      recordSelection(input.current, selected);
    } catch { setError("Nie udało się usunąć zdjęcia. Wybierz pliki ponownie przyciskiem powyżej."); }
  }
  return <div className="space-y-3">
    <p className="text-sm font-medium">Zdjęcia <span className={required ? "text-rose-700" : "text-slate-500"}>{required ? "(wymagane, od 1 do 3)" : "(opcjonalnie, do 3)"}</span></p>
    <label htmlFor={id} className={`relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 p-5 text-center transition hover:border-indigo-500 hover:bg-indigo-50 focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      <input ref={input} id={id} type="file" name="photos" multiple required={required} disabled={disabled} accept="image/jpeg,image/png,image/webp" aria-describedby={`${id}-hint${error ? " " + id + "-error" : ""}`} aria-invalid={!!error} className="sr-only" onInvalid={() => { if (!files.length && required) setError("Dodaj co najmniej jedno zdjęcie pokazujące problem."); }} onChange={event => {
        recordSelection(event.target, Array.from(event.target.files ?? []));
      }} />
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-8 w-8 text-indigo-600"><path d="M9 4 7 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2-3Z" /><circle cx="12" cy="13" r="4" /></svg>
      <span className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white">{files.length ? "Zmień wybrane zdjęcia" : "＋ Dodaj zdjęcia problemu"}</span>
      <span className="text-xs text-slate-600">Kliknij tutaj i wybierz zdjęcia z telefonu lub komputera.</span>
    </label>
    <p id={`${id}-hint`} className="text-xs text-slate-600">Wybierz do 3 zdjęć. Przed wysłaniem możesz usunąć wybrane zdjęcie przyciskiem „Usuń”. Po wysłaniu zgłoszenia nie można zmienić zdjęć.</p>
    {!!files.length && <div><p role="status" className="mb-2 text-sm font-medium text-slate-700">Wybrane zdjęcia: {files.length} / 3</p><div className="flex flex-wrap gap-3">{previews.map((photo, i) => <figure key={photo.url} className="w-24"><Image src={photo.url} alt={`Wybrane zdjęcie ${i + 1}`} width={96} height={96} unoptimized className="h-24 w-24 rounded-lg border object-cover" /><figcaption className="mt-1 truncate text-xs text-slate-500" title={photo.name}>{photo.name}</figcaption><button type="button" disabled={disabled} onClick={() => removePhoto(i)} aria-label={`Usuń zdjęcie ${i + 1}: ${photo.name}`} className="mt-2 w-full rounded-lg border border-rose-200 bg-white px-2 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-600 disabled:opacity-50">× Usuń</button></figure>)}</div></div>}
    {error && <p id={`${id}-error`} role="alert" className="text-sm text-rose-700">{error}</p>}
  </div>;
}
