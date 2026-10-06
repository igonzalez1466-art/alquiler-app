"use client";

import { useEffect, useState, type ReactNode } from "react";

export default function ReturnSection({ children, defaultOpen = false }: { children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    const reveal = () => {
      if (window.location.hash === "#return-section") setOpen(true);
    };
    if (defaultOpen) setOpen(true);
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [defaultOpen]);

  return <section id="return-section" className="p-5 border rounded-2xl bg-white scroll-mt-24">
    <h2>
      <button type="button" aria-expanded={open} aria-controls="return-section-content" onClick={() => setOpen(value => !value)} className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
        <span className="text-lg font-semibold">Zwrot <span className="text-xs text-gray-400 font-normal">(wysyłka i potwierdzenie odbioru)</span></span>
        <span aria-hidden="true" className="text-2xl text-indigo-600">{open ? "−" : "+"}</span>
      </button>
    </h2>
    <div id="return-section-content" hidden={!open} className="mt-3 space-y-3">{children}</div>
  </section>;
}
