"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { actionableTasks } from "@/app/lib/actionableTasks";
import type { PendingTask } from "@/app/lib/pendingBookingTasks";

export default function AccountNextActions() {
  const [tasks, setTasks] = useState<PendingTask[] | null>(null);
  const [clock, setClock] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let busy = false;
    const controller = new AbortController();
    async function refresh() {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const response = await fetch("/api/bookings/pending-tasks", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("fetch failed");
        const data: { tasks?: PendingTask[]; checkedAt?: string } = await response.json();
        if (!Array.isArray(data.tasks) || !data.checkedAt) throw new Error("invalid response");
        if (active) {
          setTasks(data.tasks);
          setClock(Date.parse(data.checkedAt));
          setError(false);
        }
      } catch {
        if (active) setError(true);
      } finally {
        busy = false;
      }
    }
    void refresh();
    const interval = window.setInterval(() => { setClock(Date.now()); void refresh(); }, 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("profile-tasks-updated", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("profile-tasks-updated", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const visible = tasks ? actionableTasks(tasks, clock).slice(0, 3) : [];
  return <section className="surface-card space-y-4 p-5 sm:p-6" aria-labelledby="next-actions-title">
    <div className="flex items-center justify-between gap-3">
      <h2 id="next-actions-title" className="text-lg font-semibold text-slate-900">Twoje najbliższe działania</h2>
      <Link href="/bookings" className="shrink-0 text-xs font-semibold text-violet-700 underline underline-offset-4">Wszystkie rezerwacje</Link>
    </div>
    {error && <p role="status" className="text-sm text-amber-900">Nie udało się odświeżyć zadań. Spróbuj ponownie za chwilę.</p>}
    {!tasks && !error && <p role="status" className="text-sm text-gray-600">Wczytywanie zadań…</p>}
    {tasks && visible.length === 0 && !error && <p className="text-sm text-gray-700">Nie masz teraz zadań do wykonania.</p>}
    {visible.length > 0 && <ul className="space-y-2">{visible.map(task => <li key={task.id}>
      <Link href={task.href} prefetch={false} className="block rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-violet-200 hover:bg-violet-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600">
        {task.badge && <span className="mb-1.5 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-slate-900">{task.badge}</span>}
        <span className="block font-semibold text-slate-900">{task.title} →</span>
        <span className="block text-xs text-gray-600">{task.bookingNumber === null ? "Mój profil" : `#${task.bookingNumber} · ${task.listing}`}</span>
        <span className="block text-sm text-gray-700">{task.description}</span>
        {task.actionLabel && <span className="mt-2 block text-sm font-semibold text-violet-700">{task.actionLabel} →</span>}
        {task.deadline && <span className="block pt-1 text-xs font-semibold text-rose-700">Termin: {new Date(task.deadline).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</span>}
      </Link>
    </li>)}</ul>}
    {tasks && actionableTasks(tasks, clock).length > visible.length && <p className="text-xs text-gray-600">Pozostałe działania znajdziesz pod ikoną powiadomień.</p>}
  </section>;
}
