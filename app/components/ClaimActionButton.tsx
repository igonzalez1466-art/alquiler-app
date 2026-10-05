"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

export default function ClaimActionButton({ children, loading = false, disabled, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  const { pending } = useFormStatus();
  const active = loading || pending;
  return <button {...props} type={props.type ?? "submit"} disabled={disabled || active} aria-busy={active} className={`inline-flex items-center justify-center gap-2 disabled:cursor-wait ${className}`}>
    {active && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
    {active ? "Zapisywanie…" : children}
  </button>;
}
