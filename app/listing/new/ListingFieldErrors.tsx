"use client";
import { createContext, useContext } from "react";
export const ListingErrorsContext = createContext<Record<string, string>>({});
export function ListingFieldError({ name }: { name: string }) {
  const errors = useContext(ListingErrorsContext);
  return errors[name] ? <p id={`listing-error-${name}`} role="alert" className="mt-2 text-sm text-rose-700">{errors[name]}</p> : null;
}
