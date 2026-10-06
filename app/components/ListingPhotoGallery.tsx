"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Photo = { id: string; url: string; alt: string | null };
export default function ListingPhotoGallery({ photos, title, cover = false }: { photos: Photo[]; title: string; cover?: boolean }) {
  const [index, setIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const open = index !== null;
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const previous = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => {
    const element = viewport.current;
    if (element) element.scrollTo({ top: zoom > 1 ? (element.scrollHeight - element.clientHeight) / 2 : 0, left: zoom > 1 ? (element.scrollWidth - element.clientWidth) / 2 : 0 });
  }, [zoom, index]);
  function close() { setIndex(null); setZoom(1); }
  function move(step: number) {
    setIndex(current => current === null ? null : (current + step + photos.length) % photos.length);
    setZoom(1); viewport.current?.scrollTo({ top: 0, left: 0 });
  }
  function show(i: number) { setZoom(1); setIndex(i); }
  const control = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/30 px-3 py-2 text-sm text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40";
  if (!photos.length) return <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-sm text-slate-500">Brak zdjęcia</div>;
  return <>
    {cover ? <button type="button" onClick={() => show(0)} aria-label={`Zobacz wszystkie zdjęcia: ${title}`} aria-haspopup="dialog" className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
      <Image src={photos[0].url} alt={photos[0].alt ?? title} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover transition duration-300 hover:scale-[1.02]" />
      <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium">{photos.length} zdjęć · Powiększ</span>
    </button> : <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{photos.map((photo, i) => <button key={photo.id} type="button" onClick={() => show(i)} aria-label={`Powiększ zdjęcie ${i + 1}: ${title}`} aria-haspopup="dialog" className="relative h-44 overflow-hidden rounded-lg bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 md:h-48">
      <Image src={photo.url} alt={photo.alt ?? title} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />
      <span className="absolute bottom-2 right-2 rounded-full bg-white/95 px-2 py-1 text-xs">Powiększ</span>
    </button>)}</div>}
    {open && <dialog ref={dialog} aria-label={`Zdjęcia: ${title}`} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }} onKeyDown={e => {
      if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
    }} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-slate-950/95 p-3 text-white backdrop:bg-black/75 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0"><h2 className="truncate text-sm font-semibold sm:text-base">{title}</h2><p role="status" aria-live="polite" className="text-xs text-white/70">Zdjęcie {index! + 1} z {photos.length}</p></div>
        <button type="button" autoFocus onClick={close} className={control} aria-label="Zamknij podgląd zdjęć">Zamknij ×</button>
      </header>
      <div className="my-3 flex items-center justify-center gap-2">
        <button type="button" disabled={zoom <= 1} onClick={() => setZoom(z => Math.max(1, z - 0.5))} className={control} aria-label="Pomniejsz zdjęcie">−</button>
        <span className="min-w-14 text-center text-sm">{Math.round(zoom * 100)}%</span>
        <button type="button" disabled={zoom >= 3} onClick={() => setZoom(z => Math.min(3, z + 0.5))} className={control} aria-label="Powiększ zdjęcie">+</button>
      </div>
      <div ref={viewport} className="h-[calc(100dvh-220px)] overflow-auto rounded-lg bg-black/20" onClick={e => { if (e.target === e.currentTarget) close(); }}>
        <div className="relative min-h-full min-w-full" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
          <Image src={photos[index!].url} alt={photos[index!].alt ?? `${title} — zdjęcie ${index! + 1}`} fill sizes="100vw" quality={90} className={`object-contain ${zoom === 1 ? "cursor-zoom-in" : "cursor-zoom-out"}`} onClick={() => setZoom(z => z === 1 ? 2 : 1)} />
        </div>
      </div>
      <footer className="mt-3 flex items-center justify-center gap-3">
        <button type="button" disabled={photos.length < 2} onClick={() => move(-1)} className={control} aria-label="Poprzednie zdjęcie">← Poprzednie</button>
        <button type="button" disabled={photos.length < 2} onClick={() => move(1)} className={control} aria-label="Następne zdjęcie">Następne →</button>
      </footer>
      <p className="mt-2 text-center text-xs text-white/60">Kliknij zdjęcie, aby zmienić powiększenie. Strzałki ← → zmieniają zdjęcie, Esc zamyka podgląd.</p>
    </dialog>}
  </>;
}
