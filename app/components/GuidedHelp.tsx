"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { helpTopics } from "@/app/lib/guidedHelp";
import type { HelpBookingSummary } from "@/app/lib/helpBooking";
import { formatCalendarDate } from "@/app/lib/rentalCalendarDate";

export default function GuidedHelp() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<string | null>(null);
  const [bookings, setBookings] = useState<HelpBookingSummary[]>([]);
  const [booking, setBooking] = useState<HelpBookingSummary | null>(null);
  const [view, setView] = useState<"topics" | "bookings">("topics");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const requests = controller, versions = revision;
    requests.current?.abort(); versions.current++;
    setOpen(false); setBookings([]); setBooking(null); setTopic(null); setView("topics"); setPending(false); setError(""); setLoginRequired(false);
    return () => { requests.current?.abort(); versions.current++; };
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { controller.current?.abort(); revision.current++; setOpen(false); setPending(false); trigger.current?.focus(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  function close() { controller.current?.abort(); revision.current++; setOpen(false); setPending(false); setBookings([]); setBooking(null); trigger.current?.focus(); }
  async function loadBookings(id?: string) {
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const current = ++revision.current;
    setView("bookings"); setTopic(null); setBooking(null); setBookings([]); setPending(true); setError(""); setLoginRequired(false);
    try {
      const response = await fetch("/api/help/bookings" + (id ? "?id=" + encodeURIComponent(id) : ""), { cache: "no-store", signal: abort.signal });
      if (abort.signal.aborted || current !== revision.current) return;
      if (response.status === 401) { setLoginRequired(true); return; }
      if (!response.ok) throw new Error("Nie udało się pobrać rezerwacji. Spróbuj ponownie.");
      const data = await response.json() as { bookings: HelpBookingSummary[]; hasMore: boolean; checkedAt: string };
      if (abort.signal.aborted || current !== revision.current) return;
      setBookings(data.bookings); setHasMore(data.hasMore); setCheckedAt(data.checkedAt);
      if (id) setBooking(data.bookings[0] ?? null);
    } catch { if (!abort.signal.aborted && current === revision.current) setError("Nie udało się pobrać rezerwacji. Spróbuj ponownie."); }
    finally { if (current === revision.current) setPending(false); }
  }
  function chooseTopic(id: string) { controller.current?.abort(); revision.current++; setPending(false); setView("topics"); setBooking(null); setTopic(id); setError(""); }
  const chosen = helpTopics.find(t => t.id === topic);
  const button = "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:border-violet-300 hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700";
  return <>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls="guided-help" onClick={() => { if (open) close(); else { setView("topics"); setTopic(null); setError(""); setLoginRequired(false); setOpen(true); } }} className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 1v-9.5a8.5 8.5 0 1 1 17 0Z" /><path strokeLinecap="round" d="M8 11h7M8 15h4" /></svg>Pomoc
    </button>
    {open && <aside id="guided-help" role="dialog" aria-modal="false" aria-labelledby="guided-help-title" className="fixed bottom-20 right-3 z-40 flex max-h-[calc(100dvh-7rem)] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:right-5 sm:w-[390px]">
      <div className="flex items-start justify-between gap-3 border-b bg-violet-50 p-4"><div><h2 id="guided-help-title" className="font-semibold text-slate-900">Pomoc krok po kroku</h2><p className="mt-1 text-xs leading-5 text-slate-600">Wybierz temat lub sprawdź swoją rezerwację.</p></div><button ref={closeButton} type="button" aria-label="Zamknij pomoc" onClick={close} className="rounded-lg px-3 py-1 text-xl hover:bg-violet-100">×</button></div>
      <div className="space-y-4 overflow-y-auto p-4" aria-busy={pending}>
        <button type="button" onClick={() => void loadBookings()} className={button + " w-full border-violet-200 bg-violet-50 text-violet-800"}>Moja rezerwacja →</button>
        <div className="grid grid-cols-2 gap-2">{helpTopics.map(t => <button key={t.id} type="button" onClick={() => chooseTopic(t.id)} aria-pressed={topic === t.id && view === "topics"} className={button}>{t.title}</button>)}</div>
        {chosen && view === "topics" && <div className="space-y-3 rounded-xl bg-slate-50 p-4"><h3 className="text-sm font-semibold">{chosen.title}</h3><p className="text-sm leading-6 text-slate-600">{chosen.text}</p><Link onClick={close} href={chosen.href} className="inline-block text-sm font-semibold text-violet-700 underline underline-offset-4">{chosen.action} →</Link></div>}
        {pending && <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-700 motion-reduce:animate-none" />Wczytywanie rezerwacji…</p>}
        {view === "bookings" && !pending && loginRequired && <div className="space-y-3 rounded-xl bg-slate-50 p-4"><p className="text-sm">Zaloguj się, aby zobaczyć swoje rezerwacje. Dostęp mają tylko strony danej rezerwacji.</p><Link href={"/login?callbackUrl=" + encodeURIComponent(pathname)} onClick={close} className="text-sm font-semibold text-violet-700 underline">Zaloguj się →</Link></div>}
        {error && <div role="alert" className="space-y-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><p>{error}</p><button type="button" onClick={() => void loadBookings()} className="font-semibold underline">Spróbuj ponownie</button></div>}
        {view === "bookings" && !pending && !error && !loginRequired && <>
          {booking ? <div className="space-y-4 rounded-xl border border-slate-200 p-4"><div><p className="text-xs text-slate-500">{booking.role} · Rezerwacja #{booking.number ?? booking.id}</p><h3 className="mt-1 font-semibold break-words">{booking.title}</h3><p className="mt-1 text-xs text-slate-600">{formatCalendarDate(booking.startDate)} — {formatCalendarDate(booking.endDate)}</p></div>
            <dl className="space-y-3 text-sm">{[["Rezerwacja", booking.status], ["Płatność", booking.payment], ["Dostawa", booking.delivery], ["Zwrot", booking.returnState], ...(booking.incident ? [["Zgłoszenie", booking.incident]] : [])].map(([label,value]) => <div key={label}><dt className="font-medium text-slate-900">{label}</dt><dd className="mt-1 break-words leading-5 text-slate-600">{value}</dd></div>)}</dl>
            <div className="space-y-3 rounded-xl bg-violet-50 p-3"><p className="text-sm font-semibold">Co teraz?</p><p className="text-sm leading-6">{booking.next.text}</p><Link href={booking.next.href} onClick={close} className="inline-block text-sm font-semibold text-violet-700 underline underline-offset-4">{booking.next.label} →</Link></div>
            <Link href={booking.href} onClick={close} className="inline-block text-sm text-slate-600 underline">Wszystkie szczegóły rezerwacji</Link><button type="button" onClick={() => void loadBookings(booking.id)} className={button + " w-full"}>Odśwież stan</button>
          </div> : <div className="space-y-2"><h3 className="text-sm font-semibold">Wybierz rezerwację</h3>{bookings.length === 0 ? <p className="text-sm text-slate-600">Nie masz jeszcze żadnych rezerwacji.</p> : bookings.map(b => <button key={b.id} type="button" onClick={() => void loadBookings(b.id)} className={button + " w-full"}><span className="block break-words">#{b.number ?? b.id} · {b.title}</span><span className="mt-1 block text-xs font-normal text-slate-500">{b.role} · {formatCalendarDate(b.startDate)} · {b.status}</span></button>)}{hasMore && <p className="text-xs text-slate-600">Pokazujemy 30 najnowszych rezerwacji. Starsze znajdziesz w pełnej liście.</p>}<Link href="/bookings" onClick={close} className="inline-block py-2 text-sm font-semibold text-violet-700 underline">Wszystkie rezerwacje →</Link></div>}
          {checkedAt && <p className="text-xs text-slate-500">Stan pobrany: {new Date(checkedAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}. Użyj odświeżania, aby sprawdzić zmiany.</p>}
        </>}
        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-xs"><Link href="/jak-to-dziala" onClick={close} className="text-slate-600 underline">Jak to działa?</Link><Link href="/contact" onClick={close} className="font-semibold text-violet-700 underline">Kontakt z obsługą</Link></div>
      </div>
    </aside>}
  </>;
}
