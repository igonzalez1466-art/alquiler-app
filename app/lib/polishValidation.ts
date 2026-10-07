export function polishValidationMessage(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const v = input.validity;
  if (v.customError) return input.validationMessage;
  if (v.valueMissing) return input instanceof HTMLInputElement && input.type === "checkbox" ? "Zaznacz to pole, aby kontynuować." : "Uzupełnij to pole.";
  if (v.typeMismatch) return input instanceof HTMLInputElement && input.type === "email" ? "Wpisz poprawny adres e-mail." : "Wpisz poprawną wartość.";
  if (v.rangeUnderflow && input instanceof HTMLInputElement) return "Wartość musi wynosić co najmniej " + input.min + ".";
  if (v.rangeOverflow && input instanceof HTMLInputElement) return "Wartość nie może przekraczać " + input.max + ".";
  if (v.tooShort && "minLength" in input) return "Wpisz co najmniej " + input.minLength + " znaków.";
  if (v.tooLong && "maxLength" in input) return "Możesz wpisać maksymalnie " + input.maxLength + " znaków.";
  if (v.badInput) return "Wpisz poprawną liczbę.";
  if (v.stepMismatch) return input instanceof HTMLInputElement && input.step === "1" ? "Wpisz liczbę całkowitą." : "Wpisz poprawną wartość zgodną z wymaganym krokiem.";
  if (v.patternMismatch) return input.getAttribute("title") || "Wpisz wartość w wymaganym formacie.";
  return "Sprawdź wartość w tym polu.";
}
