"use client";

import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";

const MIN_PHOTOS = 3;
const MAX_TOTAL_BYTES = 3_000_000;
const MIN_MESSAGE = "Dodaj co najmniej 3 zdjęcia, aby opublikować ogłoszenie.";
const BUSY_MESSAGE = "Poczekaj, aż zakończy się przygotowanie zdjęć.";

type Preview = { name: string; url: string };

function fileKey(file: File) {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}\u0000${file.type}`;
}

function putFilesInInput(input: HTMLInputElement, files: File[]) {
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
}

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
  const previewUrls = useRef<string[]>([]);
  const selectedFiles = useRef<File[]>([]);
  const [count, setCount] = useState(0);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function showPreviews(files: File[]) {
    previewUrls.current.forEach(URL.revokeObjectURL);
    const next = files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
    previewUrls.current = next.map((preview) => preview.url);
    setPreviews(next);
  }

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    const versionRef = version;
    const previewUrlsRef = previewUrls;
    const selectedFilesRef = selectedFiles;
    if (!input || !form) return;
    const onReset = () => {
      version.current++;
      selectedFiles.current = [];
      input.setCustomValidity("");
      showPreviews([]);
      setCount(0); setBusy(false); setMessage(""); setError("");
    };
    form.addEventListener("reset", onReset);
    return () => {
      versionRef.current++;
      previewUrlsRef.current.forEach(URL.revokeObjectURL);
      previewUrlsRef.current = [];
      selectedFilesRef.current = [];
      form.removeEventListener("reset", onReset);
    };
  }, []);

  async function prepare(input: HTMLInputElement, files: File[]) {
    const currentVersion = ++version.current;
    selectedFiles.current = files;
    putFilesInInput(input, files);
    showPreviews(files);
    setCount(files.length); setError(""); setMessage(""); setBusy(false);
    // Invalidity is set synchronously: submitting during compression is blocked.
    input.setCustomValidity(MIN_MESSAGE);
    if (files.length < MIN_PHOTOS) {
      const missing = MIN_PHOTOS - files.length;
      setError(files.length === 0
        ? MIN_MESSAGE
        : `Wybrano ${files.length} ${files.length === 1 ? "zdjęcie" : "zdjęcia"}. Dodaj jeszcze ${missing} ${missing === 1 ? "zdjęcie" : "zdjęcia"}.`);
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
      // The existing server action receives these compressed files via FormData.
      putFilesInInput(input, prepared);
      const inputFiles = input.files;
      if (!inputFiles || inputFiles.length !== prepared.length || Array.from(inputFiles).some((file, index) => file.size !== prepared[index].size)) {
        throw new Error("Nie udało się przygotować plików do wysłania. Spróbuj w innej przeglądarce.");
      }
      input.setCustomValidity("");
      setMessage(`Gotowe: ${prepared.length} zdjęć, ${(total / 1_000_000).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} MB. Możesz opublikować ogłoszenie.`);
    } catch (cause) {
      if (currentVersion !== version.current) return;
      const text = cause instanceof Error ? cause.message : "Nie udało się przygotować zdjęć. Wybierz je ponownie.";
      // Never leave the original oversized files ready to submit after failure.
      input.value = "";
      selectedFiles.current = [];
      input.setCustomValidity(text);
      showPreviews([]);
      setCount(0); setMessage(""); setError(text);
    } finally {
      if (currentVersion === version.current) setBusy(false);
    }
  }

  function addFiles(input: HTMLInputElement) {
    const additions = Array.from(input.files ?? []);
    const known = new Set(selectedFiles.current.map(fileKey));
    const merged = [...selectedFiles.current];
    for (const file of additions) {
      const key = fileKey(file);
      if (!known.has(key)) { known.add(key); merged.push(file); }
    }
    void prepare(input, merged);
  }

  function removeFile(index: number) {
    const input = inputRef.current;
    if (!input || busy) return;
    void prepare(input, selectedFiles.current.filter((_, fileIndex) => fileIndex !== index));
  }

  return (
    <div className="flex-1" aria-busy={busy}>
      <label htmlFor="photos" className="sr-only">Dodaj co najmniej 3 zdjęcia</label>
      <input
        ref={inputRef}
        id="photos" type="file" name="photos"
        accept="image/jpeg,image/png,image/webp" multiple required disabled={busy}
        aria-describedby="photos-hint photos-status photos-error"
        aria-invalid={!!error}
        onInvalid={(event) => {
          const input = event.currentTarget;
          if (!input.validationMessage || input.validity.valueMissing) {
            input.setCustomValidity(error || MIN_MESSAGE);
          }
        }}
        onChange={(event) => { addFiles(event.currentTarget); }}
        className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
      />
      <p id="photos-hint" className="mt-2 text-xs text-gray-500">
        Wybrane zdjęcia: {count} z wymaganych minimum 3. Możesz dodawać zdjęcia w kilku krokach. Zdjęcia JPG, PNG i WebP zostaną automatycznie zmniejszone.
      </p>
      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Podgląd wybranych zdjęć">
          {previews.map((preview, index) => (
            <div key={`${preview.name}-${index}`} className="relative min-w-0 rounded-lg border bg-gray-50 p-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded bg-white">
                <NextImage src={preview.url} alt={`Wybrane zdjęcie ${index + 1}`} fill unoptimized className="object-cover" />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => removeFile(index)}
                aria-label={`Usuń zdjęcie ${index + 1}: ${preview.name}`}
                title="Usuń zdjęcie"
                className="absolute right-0 top-0 flex h-7 w-7 -translate-y-1/3 translate-x-1/3 items-center justify-center rounded-full border border-gray-300 bg-white text-lg leading-none text-gray-700 shadow hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
              >
                ×
              </button>
              <p className="mt-1 truncate text-xs text-gray-700" title={preview.name}>{index + 1}. {preview.name}</p>
            </div>
          ))}
        </div>
      )}
      <p id="photos-status" role="status" className="mt-2 text-sm text-gray-600">{message}</p>
      <p id="photos-error" role="alert" className="mt-2 text-sm text-red-600">{error}</p>
    </div>
  );
}
