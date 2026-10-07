"use client";
import { useEffect } from "react";
import { polishValidationMessage } from "@/app/lib/polishValidation";

export default function PolishFormValidation() {
  useEffect(() => {
    const owned = new WeakMap<Element, string>();
    const control = (target: EventTarget | null) => target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement ? target : null;
    const invalid = (event: Event) => {
      const input = control(event.target);
      if (!input || input.validity.customError) return;
      const message = polishValidationMessage(input);
      input.setCustomValidity(message);
      owned.set(input, message);
    };
    const clear = (event: Event) => {
      const input = control(event.target);
      if (!input || !owned.has(input)) return;
      if (input.validationMessage === owned.get(input)) input.setCustomValidity("");
      owned.delete(input);
    };
    // Capture before React form handlers read validationMessage for inline errors.
    window.addEventListener("invalid", invalid, true);
    window.addEventListener("input", clear, true);
    window.addEventListener("change", clear, true);
    const reset = (event: Event) => {
      if (event.target instanceof HTMLFormElement) Array.from(event.target.elements).forEach(element => {
        if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
          if (owned.has(element) && element.validationMessage === owned.get(element)) element.setCustomValidity("");
          owned.delete(element);
        }
      });
    };
    window.addEventListener("reset", reset, true);
    return () => {
      window.removeEventListener("invalid", invalid, true);
      window.removeEventListener("input", clear, true);
      window.removeEventListener("change", clear, true);
      window.removeEventListener("reset", reset, true);
    };
  }, []);
  return null;
}
