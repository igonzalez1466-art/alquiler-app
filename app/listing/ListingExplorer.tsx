"use client";
import { useEffect, useState } from "react";
import MapClient from "./MapClient";
import ListingResults, { type Listing } from "./ListingResults";

export default function ListingExplorer({ listings, markers, showStatus }: { listings: Listing[]; markers: unknown[]; showStatus: boolean }) {
  const [desktop, setDesktop] = useState(false);
  const [desktopMap, setDesktopMap] = useState(!showStatus);
  const [mobileMap, setMobileMap] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const mapVisible = desktop ? desktopMap : mobileMap;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-600"><strong className="text-slate-900">{listings.length}</strong> ogłoszeń</p>
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1" aria-label="Widok ogłoszeń">
        <button type="button" aria-pressed={!mapVisible} onClick={() => desktop ? setDesktopMap(false) : setMobileMap(false)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${!mapVisible ? "bg-violet-100 text-violet-800" : "text-slate-600"}`}>Lista</button>
        <button type="button" aria-pressed={mapVisible} onClick={() => desktop ? setDesktopMap(true) : setMobileMap(true)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${mapVisible ? "bg-violet-100 text-violet-800" : "text-slate-600"}`}>{desktop ? "Lista i mapa" : "Mapa"}</button>
      </div>
    </div>
    <div className={desktop && mapVisible ? "grid grid-cols-[minmax(0,1fr)_minmax(300px,0.7fr)] items-start gap-6" : ""}>
      {(desktop || !mapVisible) && <ListingResults listings={listings} showStatus={showStatus} compact={desktop && mapVisible} />}
      {mapVisible && <aside className="overflow-hidden rounded-3xl border border-slate-200 bg-white lg:sticky lg:top-6" aria-label="Mapa ogłoszeń">
        <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-600">Na mapie: {markers.length} z {listings.length} ogłoszeń</p>
        {markers.length ? <MapClient markers={markers} /> : <div className="flex min-h-80 items-center justify-center p-8 text-center text-sm text-slate-500">Brak ogłoszeń z lokalizacją na mapie. Sprawdź widok listy.</div>}
      </aside>}
    </div>
  </div>;
}
