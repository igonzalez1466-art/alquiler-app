"use client";

import { useEffect, useState, type ReactNode } from "react";

export default function ReturnSection({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const reveal = () => {
      if (window.location.hash === "#return-section") setOpen(true);
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);

  return <section id="return-section" className="p-4 border rounded bg-white scroll-mt-24">
    <h2>
      <button type="button" aria-expanded={open} aria-controls="return-section-content" onClick={() => setOpen(value => !value)} className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
        <span className="text-lg font-semibold">Zwrot <span className="text-xs text-gray-400 font-normal">(uzupełnia najemca)</span></span>
        <span aria-hidden="true" className="text-2xl text-indigo-600">{open ? "−" : "+"}</span>
      </button>
    </h2>
    <div id="return-section-content" hidden={!open} className="mt-3 space-y-3">{children}</div>
  </section>;
}
