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
  return <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3" aria-labelledby="next-actions-title">
    <div className="flex items-center justify-between gap-3">
      <h2 id="next-actions-title" className="text-lg font-semibold">Wymaga Twojego działania</h2>
      <Link href="/bookings" className="text-sm font-medium text-indigo-700 underline">Wszystkie rezerwacje</Link>
    </div>
    {error && <p role="status" className="text-sm text-amber-900">Nie udało się odświeżyć zadań. Spróbuj ponownie za chwilę.</p>}
    {!tasks && !error && <p role="status" className="text-sm text-gray-600">Wczytywanie zadań…</p>}
    {tasks && visible.length === 0 && !error && <p className="text-sm text-gray-700">Nie masz teraz zadań do wykonania.</p>}
    {visible.length > 0 && <ul className="space-y-2">{visible.map(task => <li key={task.id}>
      <Link href={task.href} prefetch={false} className="block rounded-lg border bg-white p-3 hover:border-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
        <span className="font-semibold text-indigo-800">{task.title} →</span>
        <span className="block text-xs text-gray-600">{task.bookingNumber === null ? "Mój profil" : `#${task.bookingNumber} · ${task.listing}`}</span>
        <span className="block text-sm text-gray-700">{task.description}</span>
        {task.deadline && <span className="block pt-1 text-xs font-semibold text-rose-700">Termin: {new Date(task.deadline).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</span>}
      </Link>
    </li>)}</ul>}
    {tasks && actionableTasks(tasks, clock).length > visible.length && <p className="text-xs text-gray-600">Pozostałe działania znajdziesz pod ikoną powiadomień.</p>}
  </section>;
}
