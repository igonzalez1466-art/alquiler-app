"use client";
import { actionableTasks } from "@/app/lib/actionableTasks";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PendingTask } from "@/app/lib/pendingBookingTasks";
export default function PendingTasksBell({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [tasks, setTasks] = useState<PendingTask[] | null>(null);
  const [error, setError] = useState(false);
  const [clock, setClock] = useState(0);
  const serverClock = useRef<{ time: number; received: number } | null>(null);
  const visibleTasks = tasks ? actionableTasks(tasks, clock) : null;
  const panel = useRef<HTMLDetailsElement>(null);
  const reload = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true, busy = false;
    const controller = new AbortController();
    async function refresh() {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const res = await fetch("/api/bookings/pending-tasks", { cache: "no-store", signal: controller.signal });
        if (res.status === 401) { if (active) { setTasks([]); setError(false); } return; }
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        if (!Array.isArray(data.tasks)) throw new Error("invalid response");
        if (active) {
          const time = Date.parse(data.checkedAt);
          if (!Number.isFinite(time)) throw new Error("invalid server time");
          serverClock.current = { time, received: performance.now() };
          setClock(time); setTasks(data.tasks); setError(false);
        }
      } catch { if (active) setError(true); }
      finally { busy = false; }
    }
    reload.current = () => { void refresh(); };
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 30000);
    window.addEventListener("focus", reload.current);
    document.addEventListener("visibilitychange", reload.current);
    const listener = reload.current;
    return () => { active = false; controller.abort(); clearInterval(interval); window.removeEventListener("focus", listener); document.removeEventListener("visibilitychange", listener); };
  }, [userId, pathname]);
  useEffect(() => {
    const tick = () => {
      const sync = serverClock.current;
      if (sync) setClock(sync.time + performance.now() - sync.received);
    };
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (panel.current && !panel.current.contains(event.target as Node)) panel.current.open = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && panel.current) { panel.current.open = false; panel.current.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);
  return <details ref={panel} className="relative" onToggle={event => { if (event.currentTarget.open) reload.current(); }}>
    <summary className="relative flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 [&::-webkit-details-marker]:hidden" title="Powiadomienia — oczekujące działania" aria-label={`Powiadomienia${tasks ? `: ${visibleTasks!.length} oczekujących działań` : ""}`}>
      <svg aria-hidden="true" focusable="false" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>{!!visibleTasks?.length && <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs text-white">{visibleTasks!.length > 99 ? "99+" : visibleTasks!.length}</span>}{error && <span title="Nie udało się odświeżyć" className="absolute -bottom-1 right-0 text-xs font-bold text-amber-700">!</span>}
    </summary>
    <div className="fixed inset-x-3 top-16 z-50 rounded-lg border bg-white p-3 shadow-lg md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-96">
      <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Powiadomienia</h2><button type="button" onClick={() => reload.current()} className="text-sm underline">Odśwież</button></div>
      {error && <p role="status" className="my-2 text-sm text-amber-800">Nie udało się odświeżyć listy. Wyświetlone zadania mogą być nieaktualne.</p>}
      {!tasks && !error && <p className="py-3 text-sm">Wczytywanie…</p>}
      {visibleTasks?.length === 0 && !error && <p className="py-3 text-sm">Nie masz teraz zadań do wykonania.</p>}
      <ul className="max-h-[60vh] overflow-y-auto divide-y">{visibleTasks?.map(task => <li key={task.id}><Link prefetch={false} href={task.href} onClick={() => { if (panel.current) panel.current.open = false; }} className="block rounded p-3 hover:bg-gray-50">
        <p className="text-sm font-semibold">{task.title}</p><p className="text-xs text-gray-600">#{task.bookingNumber} · {task.listing}</p><p className="mt-1 text-sm">{task.description}</p>
        {task.deadline && <p className="mt-1 text-xs text-rose-700">Termin: {new Date(task.deadline).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>}
      </Link></li>)}</ul>
      <p className="border-t pt-2 text-xs text-gray-500">Zadania znikają po wykonaniu lub upływie terminu działania. Zaległe zwroty i nierozstrzygnięte sprawy pozostają widoczne. Daty w czasie polskim.</p>
    </div>
  </details>;
}
