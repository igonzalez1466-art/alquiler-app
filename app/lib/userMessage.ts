const POLISH_MESSAGE = /^(?:Nie|Brak|Podaj|Wpisz|Wybierz|Uzupełnij|Zaloguj|Zaznacz|Potwierdź|Sprawdź|Hasło|Hasła|Link|Ten|Ta|To|Te|Tylko|Można|Możesz|Musisz|Kwota|Cena|Rezerwacja|Rezerwację|Płatność|Płatności|Termin|Przedmiot|Zdjęcie|Zdjęcia|Właściciel|Najemca|Najpierw|Odbiór|Zwrot|Wysyłkę|Konto|Numer|Adres|Kod|Osiągnięto|Wystąpił|Błąd|Minimalny|Maksymalna|Opis|Opisz|Po|Przed|Dodatkowy|Historyczne|Zewnętrzny|Wcześniejsza|Potrącenie|Odśwież|Zgłoszenie|Zgłoszenia|Zgłoszony|Zmiana|Obie|Uzgodniony|Jeśli|E-mail|Odzież|Rodzaj|Propozycja|Komentarz|Stan|Dostawa|Dane|Wypłata|Rozliczenie|Zapis|Zapisano|Zgoda|Nieprawidłow)[\sąćęłńóśźża-z]/u;
export function userMessage(value: unknown, fallback = "Nie udało się wykonać tej czynności. Spróbuj ponownie."): string {
  const message = value instanceof Error ? value.message : typeof value === "string" ? value : "";
  return POLISH_MESSAGE.test(message) && !/[<>]/.test(message) ? message : fallback;
}
