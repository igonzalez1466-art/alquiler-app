"use client";
import { useState } from "react";
type Event = { at: string; title: string; detail?: string };
export default function IncidentTimeline({ events }: { events: Event[] }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const visible = expanded ? sorted : sorted.slice(0, 5);
  return <section className="space-y-4 rounded-2xl border bg-white p-5 sm:p-6" aria-labelledby="incident-timeline">
    <div><h2 id="incident-timeline" className="text-lg font-semibold">Ostatnie aktualizacje</h2><p className="mt-1 text-sm text-slate-500">Najnowsze informacje na górze. Daty w czasie polskim.</p></div>
    {visible.length ? <ol className="space-y-3">{visible.map((event, i) => <li key={event.at + i} className={`rounded-xl border p-4 ${i === 0 ? "border-indigo-200 bg-indigo-50/60" : "border-slate-200 bg-white"}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2"><time dateTime={event.at} className="text-xs text-slate-500">{new Date(event.at).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "medium", timeStyle: "short" })}</time>{i === 0 && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">Najnowsze</span>}</div>
      <h3 className="text-sm font-semibold text-slate-900">{event.title}</h3>{event.detail && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{event.detail}</p>}
    </li>)}</ol> : <p className="text-sm text-slate-500">Brak zapisanych aktualizacji. Aktualny stan zgłoszenia znajdziesz powyżej.</p>}
    {sorted.length > 5 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)} className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-slate-50">{expanded ? "Pokaż tylko ostatnie 5" : `Pokaż pełną historię (${sorted.length})`}</button>}
  </section>;
}
