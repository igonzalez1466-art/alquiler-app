import type { IssueDetails } from "./logisticsIssue";

type Stage = "DELIVERY" | "RETURN";

export type IssueGuidance = {
  nextStep: string;
  rent: string;
  deposit: string;
};

// These are review prompts, not decisions about liability or money movement.
export function logisticsIssueGuidance(stage: Stage, reason: IssueDetails["reason"]): IssueGuidance {
  if (stage === "DELIVERY") {
    switch (reason) {
      case "NOT_RECEIVED": return {
        nextStep: "Sprawdź śledzenie i dowód wydania. Jeśli przedmiot nie dotarł, ustal ponowną dostawę albo anulowanie rezerwacji.",
        rent: "Przy potwierdzonym braku dostawy rozważ zwrot ceny najmu; przy późniejszym odbiorze uzgodnij nowe daty lub rabat.",
        deposit: "Jeśli najemca nigdy nie otrzymał przedmiotu i rezerwacja zostanie anulowana, kaucja powinna wrócić w całości.",
      };
      case "DAMAGED":
      case "DIRTY":
      case "MISSING_ITEMS": return {
        nextStep: "Porównaj zdjęcia ogłoszenia, przekazania i odbioru. Ustal naprawę, uzupełnienie braków, rabat albo anulowanie, jeśli przedmiot nie nadaje się do użycia.",
        rent: "Rabat lub zwrot ceny najmu wymaga uzgodnienia rzeczywistego wpływu problemu na korzystanie z przedmiotu.",
        deposit: "Stan lub braki zgłoszone przy odbiorze nie mogą być później automatycznie potrącone z kaucji najemcy.",
      };
      case "WRONG_ITEM": return {
        nextStep: "Porównaj otrzymany przedmiot z ogłoszeniem. Właściciel może dostarczyć właściwy przedmiot albo strony mogą uzgodnić anulowanie.",
        rent: "Jeśli właściwy przedmiot nie zostanie dostarczony, rozważ pełny zwrot ceny najmu; przy późniejszej dostawie uzgodnij zmianę terminu.",
        deposit: "Po anulowaniu i zwrocie otrzymanego przedmiotu kaucja powinna wrócić w całości.",
      };
      case "LATE_DELIVERY": return {
        nextStep: "Porównaj początek najmu z nadaniem i faktycznym odbiorem. Sprawdź historię przewoźnika oraz czy przedmiot nadal jest potrzebny.",
        rent: "Możliwe rozwiązania to przesunięcie okresu najmu, uzgodniony rabat za utracony czas albo anulowanie, jeśli najem nie ma już sensu.",
        deposit: "Opóźnienie dostawy nie jest podstawą do potrącenia kaucji najemcy.",
      };
      default: return {
        nextStep: "Sprawdź opis zgłoszenia, historię przesyłki i zdjęcia; ustal rozwiązanie z drugą stroną lub obsługą.",
        rent: "Cena najmu nie zmienia się na podstawie samego zgłoszenia.",
        deposit: "Kaucja nie zmienia się na podstawie samego zgłoszenia.",
      };
    }
  }

  switch (reason) {
    case "NOT_RECEIVED": return {
      nextStep: "Sprawdź potwierdzenie nadania, śledzenie i odbiór w punkcie. Ustal, czy przedmiot nadal ma najemca, czy przesyłka zaginęła w transporcie.",
      rent: "Dodatkowy czas najmu rozważ tylko wtedy, gdy przedmiot pozostał u najemcy po terminie; sam czas transportu nie dowodzi takiego opóźnienia.",
      deposit: "Nie potrącaj kaucji automatycznie. Roszczenie za brak zwrotu wymaga wyjaśnienia i udokumentowania.",
    };
    case "DAMAGED": return {
      nextStep: "Porównaj zdjęcia sprzed najmu i po zwrocie oraz przedstaw koszt naprawy. Pomiń zwykłe zużycie i uszkodzenia wcześniejsze.",
      rent: "Pierwotna cena najmu pozostaje bez zmian.",
      deposit: "Możliwe roszczenie do wysokości uzasadnionego kosztu naprawy, po zgodzie najemcy lub decyzji obsługi.",
    };
    case "DIRTY": return {
      nextStep: "Porównaj zdjęcia i udokumentuj, czy konieczne jest ponadstandardowe czyszczenie.",
      rent: "Pierwotna cena najmu pozostaje bez zmian.",
      deposit: "Możliwe roszczenie o rzeczywisty, uzasadniony koszt czyszczenia; nie za zwykłe ślady używania.",
    };
    case "MISSING_ITEMS": return {
      nextStep: "Sprawdź, czy element był przekazany na początku. Daj najemcy możliwość oddania brakującej części.",
      rent: "Pierwotna cena najmu pozostaje bez zmian.",
      deposit: "Możliwe roszczenie o uzasadniony koszt brakującego elementu, jeśli jego wydanie na początku jest potwierdzone.",
    };
    case "LATE_RETURN": return {
      nextStep: "Porównaj koniec najmu z faktycznym przekazaniem zwrotu. Sprawdź, czy opóźnienie dotyczy najemcy czy przewoźnika.",
      rent: "Koszt dodatkowego czasu można zaproponować tylko za opóźnienie po stronie najemcy, według wcześniej ustalonej stawki.",
      deposit: "Jeśli koszt ma być pokryty z kaucji, potrzebna jest zgoda najemcy lub decyzja obsługi. Nie pobieraj drugi raz tej samej kwoty jako dopłaty do najmu.",
    };
    default: return {
      nextStep: "Sprawdź opis zgłoszenia, historię przesyłki i zdjęcia; ustal rozwiązanie z drugą stroną lub obsługą.",
      rent: "Pierwotna cena najmu nie zmienia się na podstawie samego zgłoszenia.",
      deposit: "Kaucja pozostaje do rozliczenia zgodnie z wynikiem sprawy.",
    };
  }
}

export function logisticsTimeObservations(
  stage: Stage,
  expectedAt: Date,
  sentAt: Date | null,
  receivedAt: Date | null,
): string[] {
  const observations: string[] = [];
  if (!sentAt) observations.push("Brak zapisanej w aplikacji daty nadania lub przekazania.");
  else if (sentAt > expectedAt) observations.push(stage === "DELIVERY"
    ? "Nadanie zapisano po planowanym początku najmu. Sprawdź, kiedy przedmiot faktycznie dotarł."
    : "Zwrot oznaczono jako wysłany po końcu najmu. Sprawdź faktyczną godzinę przekazania przedmiotu.");
  else if (stage === "RETURN" && receivedAt && receivedAt > expectedAt) observations.push(
    "Zwrot oznaczono jako wysłany przed końcem najmu, ale odbiór zapisano później. Opóźnienie przewoźnika samo w sobie nie obciąża najemcy.",
  );
  if (stage === "DELIVERY" && receivedAt && receivedAt > expectedAt) observations.push(
    "Odbiór w aplikacji zapisano po planowanym początku najmu. Data w aplikacji może różnić się od faktycznej godziny przekazania.",
  );
  if (!receivedAt) observations.push("Brak zapisanej daty odbioru przedmiotu.");
  return observations;
}
