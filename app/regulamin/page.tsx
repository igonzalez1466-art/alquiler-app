import Link from "next/link";
import type { ReactNode } from "react";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 space-y-4">
      <h2 className="text-2xl font-semibold text-zinc-950">{title}</h2>
      {children}
    </section>
  );
}

const listClass = "list-disc space-y-2 pl-6";

export default function RegulaminPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-zinc-800">
      <h1 className="text-3xl font-bold text-zinc-950">Regulamin serwisu MojaSzafa</h1>
      <p className="mt-3 text-sm text-zinc-600">Projekt do konsultacji prawnej · 2 października 2026 r.</p>
      <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
        <strong>Przed publikacją:</strong> uzupełnij dane operatora w § 1 oraz
        potwierdź z prawnikiem zasady płatności, zwrotów i informowania o statusie
        właściciela jako przedsiębiorcy lub osoby prywatnej.
      </div>

      <Section title="§ 1. Operator i kontakt">
        <p>
          Serwis MojaSzafa prowadzi <strong>[pełna nazwa albo imię i nazwisko operatora]</strong>,
          z siedzibą lub adresem zamieszkania: <strong>[pełny adres]</strong>,
          NIP: <strong>[numer, jeśli dotyczy]</strong>, zwany dalej „Operatorem”.
          Kontakt: <a className="underline" href="mailto:kontakt@mojaszafa.com">kontakt@mojaszafa.com</a>
          {" "}lub <Link className="underline" href="/contact">formularz kontaktowy</Link>.
        </p>
        <p>Regulamin określa warunki korzystania z serwisu oraz zasady rezerwacji i płatności za najem.</p>
      </Section>

      <Section title="§ 2. Pojęcia i rola serwisu">
        <ul className={listClass}>
          <li><strong>Właściciel</strong> — użytkownik udostępniający przedmiot do najmu.</li>
          <li><strong>Najemca</strong> — użytkownik składający prośbę o rezerwację.</li>
          <li><strong>Rezerwacja</strong> — zapis przedmiotu, terminu i ceny najmu.</li>
        </ul>
        <p>
          Umowa najmu przedmiotu jest zawierana między właścicielem a najemcą.
          Operator udostępnia narzędzia do jej zawarcia i wykonania oraz uczestniczy
          w obsłudze płatności i rozliczeń opisanych poniżej. Operator nie jest
          właścicielem przedmiotów wystawianych przez użytkowników.
        </p>
      </Section>

      <Section title="§ 3. Konto i warunki techniczne">
        <ul className={listClass}>
          <li>Z serwisu mogą korzystać osoby, które ukończyły 18 lat. Dane konta powinny być prawidłowe i aktualne.</li>
          <li>Użytkownik odpowiada za poufność danych logowania i nie powinien udostępniać konta innym osobom.</li>
          <li>Złożenie i zaakceptowanie prośby o rezerwację wymaga zweryfikowanego numeru telefonu.</li>
          <li>Zakazane jest publikowanie treści bezprawnych, wprowadzających w błąd lub naruszających prawa osób trzecich.</li>
          <li>Korzystanie z serwisu wymaga urządzenia z internetem, aktualnej przeglądarki, aktywnego adresu e-mail i obsługi niezbędnych plików cookie.</li>
        </ul>
        <p>
          Użytkownik może zgłosić chęć zamknięcia konta przez formularz kontaktowy.
          Dane dotyczące trwających rezerwacji, rozliczeń i obowiązków prawnych
          mogą wymagać dalszego przechowywania.
        </p>
      </Section>

      <Section title="§ 4. Ogłoszenia i cena">
        <p>
          Właściciel odpowiada za zgodność opisu, zdjęć, stanu, kompletności
          i dostępności przedmiotu z ogłoszeniem. Najemca widzi cenę najmu
          przed potwierdzeniem płatności.
        </p>
        <p>
          Standardowa prowizja MojaSzafa wynosi 15% ceny najmu i jest potrącana
          z kwoty należnej właścicielowi. Kwoty
          konkretnej rezerwacji są zapisywane przy jej utworzeniu.
        </p>
      </Section>

      <Section title="§ 5. Rezerwacja i terminy">
        <ol className="list-decimal space-y-2 pl-6">
          <li>Najemca wybiera przedmiot i termin oraz wysyła prośbę o rezerwację.</li>
          <li>Właściciel ma 12 godzin od utworzenia prośby na jej akceptację. Może ją także odrzucić. Po upływie terminu akceptacja nie jest możliwa, a prośba podlega anulowaniu.</li>
          <li>Od akceptacji najemca ma 12 godzin na opłacenie rezerwacji. Brak potwierdzonej płatności w terminie powoduje anulowanie rezerwacji.</li>
          <li>Po potwierdzeniu płatności strony realizują przekazanie, najem i zwrot przedmiotu zgodnie z danymi rezerwacji.</li>
        </ol>
        <p>
          Zgłoszenie problemu albo prośba o anulowanie już opłaconej rezerwacji
          nie powodują automatycznie zwrotu ceny najmu. Strony powinny opisać
          sytuację w serwisie i skontaktować się z Operatorem, jeżeli potrzebne
          jest rozliczenie. Nie ogranicza to uprawnień wynikających z prawa.
        </p>
      </Section>

      <Section title="§ 6. Płatność i wypłata">
        <p>
          Najemca opłaca w serwisie cenę najmu. Serwis nie pobiera kaucji
          przy nowych rezerwacjach. Płatność przetwarza Stripe. Operator obsługuje
          rozliczenie tej płatności: zleca ewentualne zwroty najemcy oraz transfer
          należnej ceny najmu na rzecz właściciela za pośrednictwem Stripe.
        </p>
        <p>
          Wypłata należnej części ceny najmu właścicielowi, pomniejszona o
          prowizję MojaSzafa, jest zlecana przy końcowym rozliczeniu rezerwacji.
          Wymaga aktywnego konta wypłat właściciela w Stripe. Czas zaksięgowania
          zwrotu lub wypłaty zależy także od Stripe i instytucji płatniczych.
        </p>
      </Section>

      <Section title="§ 7. Dostawa, odbiór i zwrot przedmiotu">
        <p>
          Strony wybierają dostępny sposób przekazania przedmiotu. Przy wysyłce
          InPost osoba nadająca samodzielnie tworzy i opłaca przesyłkę. W serwisie
          może zapisać numer śledzenia. Punkt InPost z profilu można zmienić dla
          konkretnej rezerwacji przed oznaczeniem odpowiedniego etapu jako wysłanego.
        </p>
        <p>
          Właściciel oznacza przedmiot jako wysłany lub przekazany, a najemca
          potwierdza odbiór albo zgłasza problem. Po zakończeniu najmu najemca
          oznacza zwrot jako wysłany lub przekazany, a właściciel potwierdza
          odbiór albo zgłasza problem. Sam status przewoźnika nie przesądza
          o faktycznym przekazaniu przedmiotu między stronami.
        </p>
      </Section>

      <Section title="§ 8. Incydenty i dowody">
        <p>
          Przy odbiorze najemca może zgłosić brak przedmiotu, uszkodzenie,
          zabrudzenie, brak elementów, przedmiot niezgodny z ogłoszeniem
          albo opóźnioną dostawę. Przy zwrocie właściciel może zgłosić brak
          przedmiotu, uszkodzenie, zabrudzenie, brak elementów, zwrot innego
          przedmiotu albo zwrot po terminie. Zgłoszenie wymaga opisu i zostaje
          zapisane w historii rezerwacji.
        </p>
        <p>
          Strony mogą dodawać zdjęcia na etapach przewidzianych w serwisie.
          Każde zdjęcie jest powiązane z rezerwacją, osobą, etapem i czasem
          dodania; po zapisaniu nie można go podmienić. Warto zachować również
          historię przesyłki i korespondencję.
        </p>
        <p>
          Samo zgłoszenie nie obniża automatycznie ceny najmu. Rozwiązanie
          wymaga wyjaśnienia okoliczności lub uzgodnienia stron.
        </p>
      </Section>

      <Section title="§ 9. Problemy ze stanem przedmiotu i wcześniejsze kaucje">
        <p>
          Właściciel i najemca mogą zgłosić problem ze stanem przedmiotu w
          odpowiednim etapie rezerwacji. Zgłoszenie i zdjęcia pomagają wyjaśnić
          okoliczności, ale nie są automatyczną decyzją o odpowiedzialności ani
          podstawą do pobrania dodatkowej kwoty przez serwis. Strony mogą
          uzgodnić rozwiązanie lub dochodzić swoich praw zgodnie z prawem.
        </p>
        <p>
          Rezerwacje, w których kaucja została pobrana przed wyłączeniem tej
          funkcji, zachowują zapisane kwoty i dostęp do ich dotychczasowego
          rozliczenia. Zmiana dotycząca nowych rezerwacji nie usuwa historii
          ani nie zmienia rozliczeń już pobranych środków.
        </p>
      </Section>

      <Section title="§ 10. Reklamacje i treści użytkowników">
        <p>
          Problem z działaniem serwisu, płatnością, zwrotem środków lub treścią
          ogłoszenia można zgłosić na kontakt@mojaszafa.com albo przez formularz
          kontaktowy. Warto podać numer rezerwacji, opis zdarzenia i dowody.
          Operator odpowiada bez zbędnej zwłoki, zgodnie z obowiązującym prawem.
        </p>
        <p>
          Operator może ograniczyć widoczność bezprawnych treści lub dostęp do
          konta naruszającego regulamin, stosując środki proporcjonalne do
          okoliczności. Użytkownik może zakwestionować taką decyzję przez
          wskazane kanały kontaktu. Spory o stan przedmiotu należy zgłaszać
          również w odpowiedniej rezerwacji.
        </p>
      </Section>

      <Section title="§ 11. Prawa stron i odpowiedzialność">
        <p>
          Prawa stron umowy najmu zależą od okoliczności, w szczególności od
          tego, czy właściciel działa jako przedsiębiorca, czy osoba prywatna.
          Regulamin nie wyłącza ustawowych praw konsumentów. Operator odpowiada
          za własne obowiązki związane z działaniem serwisu i obsługą płatności
          w zakresie przewidzianym przez prawo.
        </p>
        <p>
          Właściciel odpowiada wobec najemcy za zgodność przedmiotu z opisem,
          a najemca za korzystanie z niego i zwrot na uzgodnionych warunkach.
          Strony mogą korzystać z dostępnych środków ochrony prawnej.
        </p>
      </Section>

      <Section title="§ 12. Dane osobowe i zmiany regulaminu">
        <p>
          Zasady przetwarzania danych opisują <Link className="underline" href="/polityka-prywatnosci">Polityka prywatności</Link>
          {" "}i <Link className="underline" href="/polityka-cookies">Polityka plików cookie</Link>.
          Regulamin jest udostępniany bezpłatnie w sposób umożliwiający jego
          zapisanie i odtworzenie.
        </p>
        <p>
          O istotnych zmianach regulaminu Operator poinformuje z odpowiednim
          wyprzedzeniem. Zmiany nie pozbawiają stron praw nabytych w odniesieniu
          do rezerwacji zawartych przed ich wejściem w życie.
        </p>
      </Section>
    </main>
  );
}
