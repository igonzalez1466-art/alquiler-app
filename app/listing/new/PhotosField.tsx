"use client";

import { useEffect, useRef, useState } from "react";

const MIN_PHOTOS = 3;
const MAX_TOTAL_BYTES = 3_000_000;
const MIN_MESSAGE = "Dodaj co najmniej 3 zdjęcia, aby opublikować ogłoszenie.";
const BUSY_MESSAGE = "Poczekaj, aż zakończy się przygotowanie zdjęć.";

async function compressPhoto(file: File, budget: number): Promise<File> {
  if (!file.size || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Wybierz zdjęcia JPG, PNG lub WebP. Zdjęcia HEIC zapisz najpierw jako JPG.");
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Nie można odczytać jednego ze zdjęć. Wybierz inny plik."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Ta przeglądarka nie może przygotować zdjęć.");
    for (const maxSide of [1600, 1280, 1024, 800]) {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.72, 0.6]) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Nie udało się przygotować zdjęcia.")), "image/jpeg", quality);
        });
        if (blob.size <= budget) {
          return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
        }
      }
    }
    throw new Error("Zdjęcia nadal zajmują zbyt dużo miejsca. Wybierz mniej zdjęć (minimum 3) lub mniejsze pliki.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PhotosField() {
  const inputRef = useRef<HTMLInputElement>(null);
  const version = useRef(0);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!input || !form) return;
    const onReset = () => {
      version.current++;
      input.setCustomValidity("");
      setCount(0); setBusy(false); setMessage(""); setError("");
    };
    form.addEventListener("reset", onReset);
    return () => { version.current++; form.removeEventListener("reset", onReset); };
  }, []);

  async function prepare(input: HTMLInputElement) {
    const currentVersion = ++version.current;
    const files = Array.from(input.files ?? []);
    setCount(files.length); setError(""); setMessage(""); setBusy(false);
    // Invalidity is set synchronously: submitting during compression is blocked.
    input.setCustomValidity(MIN_MESSAGE);
    if (files.length < MIN_PHOTOS) {
      input.value = "";
      setCount(0); setError(MIN_MESSAGE);
      return;
    }
    input.setCustomValidity(BUSY_MESSAGE);
    setBusy(true);
    try {
      const budget = Math.min(600_000, Math.floor(MAX_TOTAL_BYTES / files.length));
      const prepared: File[] = [];
      for (const file of files) {
        if (currentVersion !== version.current) return;
        setMessage(`Przygotowywanie zdjęć: ${prepared.length + 1} / ${files.length}…`);
        prepared.push(await compressPhoto(file, budget));
      }
      if (currentVersion !== version.current) return;
      const total = prepared.reduce((sum, file) => sum + file.size, 0);
      if (total > MAX_TOTAL_BYTES) throw new Error("Wybierz mniejsze zdjęcia lub zmniejsz ich liczbę (minimum 3).");
      const transfer = new DataTransfer();
      prepared.forEach((file) => transfer.items.add(file));
      // The existing server action receives these compressed files via FormData.
      input.files = transfer.files;
      if (input.files.length !== prepared.length || Array.from(input.files).some((file, index) => file.size !== prepared[index].size)) {
        throw new Error("Nie udało się przygotować plików do wysłania. Spróbuj w innej przeglądarce.");
      }
      input.setCustomValidity("");
      setMessage(`Gotowe: ${prepared.length} zdjęć, ${(total / 1_000_000).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} MB. Możesz opublikować ogłoszenie.`);
    } catch (cause) {
      if (currentVersion !== version.current) return;
      const text = cause instanceof Error ? cause.message : "Nie udało się przygotować zdjęć. Wybierz je ponownie.";
      // Never leave the original oversized files ready to submit after failure.
      input.value = "";
      input.setCustomValidity(text);
      setCount(0); setMessage(""); setError(text);
    } finally {
      if (currentVersion === version.current) setBusy(false);
    }
  }

  return (
    <div className="flex-1" aria-busy={busy}>
      <label htmlFor="photos" className="sr-only">Dodaj co najmniej 3 zdjęcia</label>
      <input
        ref={inputRef}
        id="photos" type="file" name="photos"
        accept="image/jpeg,image/png,image/webp" multiple required
        aria-describedby="photos-hint photos-status photos-error"
        aria-invalid={!!error}
        onInvalid={(event) => {
          const input = event.currentTarget;
          if (!input.validationMessage || input.validity.valueMissing) {
            input.setCustomValidity(error || MIN_MESSAGE);
          }
        }}
        onChange={(event) => { void prepare(event.currentTarget); }}
        className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
      />
      <p id="photos-hint" className="mt-2 text-xs text-gray-500">
        Wybrane zdjęcia: {count}. Minimum: 3. Wybierz wszystkie zdjęcia jednocześnie. Zdjęcia JPG, PNG i WebP zostaną automatycznie zmniejszone.
      </p>
      <p id="photos-status" role="status" className="mt-2 text-sm text-gray-600">{message}</p>
      <p id="photos-error" role="alert" className="mt-2 text-sm text-red-600">{error}</p>
    </div>
  );
}
