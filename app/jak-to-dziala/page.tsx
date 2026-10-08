import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Jak to działa? — MojaSzafa",
  description: "Sprawdź, jak wypożyczyć lub udostępnić ubranie: rezerwacja, płatność, dostawa, zwrot i zgłoszenie problemu w MojaSzafa.",
};

const renterSteps = [
  ["Wybierz ubranie i termin", "Znajdź przedmiot, sprawdź rozmiar, opis oraz preferowaną dostawę. Wybierz daty zgodne z minimalnym czasem najmu podanym w ogłoszeniu."],
  ["Zarezerwuj i zapłać", "Wyślij prośbę o rezerwację. Po akceptacji właściciela opłać najem na stronie rezerwacji. Nie pobieramy kaucji w płatności."],
  ["Uzgodnij dostawę", "Ustal z właścicielem wysyłkę InPost lub odbiór osobisty. Przy wysyłce uzupełnij punkt InPost do dostawy w rezerwacji. Korzystaj z czatu, aby zachować ustalenia w jednym miejscu."],
  ["Sprawdź i potwierdź odbiór", "Obejrzyj otrzymany przedmiot przed potwierdzeniem odbioru. Jeśli wszystko się zgadza, wybierz „Otrzymałem”. Jeśli jest problem, wybierz „Zgłoś problem” i uzupełnij zgłoszenie."],
  ["Zwróć przedmiot", "Uzgodnij zwrot z właścicielem i dotrzymaj terminu. W sekcji „Zwrot” wpisz sposób przekazania, a przy wysyłce numer przesyłki. Możesz dodać zdjęcia i oznaczyć zwrot jako „Wysłano / Przekazano”. Właściciel potwierdzi odbiór."],
];
const ownerSteps = [
  ["Przygotuj ogłoszenie", "Dodaj co najmniej 3 wyraźne zdjęcia, opis, rozmiar, lokalizację i cenę. Wybierz preferowaną dostawę oraz minimalny czas najmu: 3, 5, 7 dni lub własny, nie krótszy niż 3 dni."],
  ["Zaakceptuj rezerwację", "Sprawdź termin i zaakceptuj prośbę najemcy. Poczekaj na potwierdzenie płatności, zanim wyślesz lub przekażesz przedmiot."],
  ["Wyślij lub przekaż przedmiot", "Uzgodnij szczegóły na czacie. W rezerwacji wybierz InPost i podaj numer przesyłki albo zaznacz odbiór osobisty. Następnie zaktualizuj status wybierając „Wysłano / Przekazano”."],
  ["Poczekaj na potwierdzenie odbioru", "Wypłata najmu jest wstrzymana do potwierdzenia odbioru przez najemcę lub uzgodnionego rozwiązania problemu z dostawą. Do otrzymywania wypłat uzupełnij dane do rozliczeń w „Moje konto”."],
  ["Potwierdź zwrot", "Po otrzymaniu przedmiotu sprawdź go i wybierz „Otrzymałem zwrot”. Jeśli jest problem ze zwrotem, zgłoś go na stronie rezerwacji."],
];
const questions = [
  ["Czy muszę wpłacić kaucję?", "Przy rezerwacji nie pobieramy kaucji — w aplikacji płacisz wyłącznie za wynajem. Sposób i termin przekazania oraz zwrotu przedmiotu ustal bezpośrednio z drugą stroną."],
  ["Kiedy właściciel otrzymuje pieniądze?", "Samo opłacenie rezerwacji lub oznaczenie wysyłki nie uruchamia wypłaty właścicielowi. Najpierw najemca potwierdza odbiór albo obie strony akceptują rozwiązanie zgłoszenia dostawy. Termin wpływu pieniędzy zależy również od obsługi płatności i banku."],
  ["Co zrobić, jeśli przedmiot jest uszkodzony lub niezgodny z ogłoszeniem?", "Przed potwierdzeniem odbioru wybierz „Zgłoś problem” w sekcji dostawy. Przy uszkodzeniu lub niezgodności z opisem wymagane są zdjęcia. Wybierz wszystkie zdjęcia przed wysłaniem zgłoszenia — maksymalnie 3. Po zapisaniu nie można dodać kolejnych. Zgłoszenie wstrzymuje wypłatę do uzgodnienia rozwiązania."],
  ["Co zrobić, jeśli dostawa jest opóźniona?", "Wybierz „Opóźniona dostawa” i podaj rzeczywistą datę odbioru. Właściciel zobaczy datę oraz sugestię zwrotu: kwota najmu × dni opóźnienia / dni rezerwacji, maksymalnie 100%. Sugestia nie uruchamia zwrotu. Właściciel proponuje rozwiązanie, a najemca je akceptuje lub odrzuca z komentarzem."],
  ["Czy mogę anulować rezerwację?", "Najemca może anulować kwalifikującą się rezerwację najpóźniej 7 dni przed jej rozpoczęciem, korzystając z przycisku na stronie rezerwacji. Jeśli najem został opłacony, przysługuje zwrot 100% zapłaconego najmu. Dostępność przycisku i termin sprawdzisz w rezerwacji. Obie strony otrzymują powiadomienie e-mail."],
  ["Czy mogę poprosić o anulowanie po otrzymaniu niewłaściwego przedmiotu?", "Tak, jeśli pierwotnym powodem zgłoszenia dostawy jest niezgodność przedmiotu z ogłoszeniem. W swojej kolejce odpowiedzi najemca może poprosić o anulowanie i zwrot 100% najmu. Właściciel musi zaakceptować tę prośbę. Samo jej wysłanie nie anuluje rezerwacji i nie zwraca pieniędzy. Po akceptacji, jeśli masz przedmiot, uzgodnij jego jak najszybszy zwrot i wpisz dane w sekcji „Zwrot”."],
  ["Jak odpowiadać na zgłoszenie?", "W sekcji „Zgłoszenia i uzgodnienia” zobaczysz, czyja jest kolej. Gdy czekasz na drugą stronę, działania są zablokowane. Propozycję można zaakceptować albo odrzucić z obowiązkowym komentarzem. Zmiana kwoty najmu wymaga zgody obu stron. Powiadomienia i e-maile prowadzą do aktualnej sprawy."],
  ["Co z uszkodzeniem, opóźnieniem lub brakiem zwrotu?", "Po potwierdzeniu odbioru najem nie służy jako zabezpieczenie przedmiotu. Zgłoszenie zwrotu nie zmniejsza należnego najmu. MojaSzafa zapisuje zgłoszenie i dowody do analizy historii konta; nie ustala odszkodowania ani winy. Roszczenia dotyczące przedmiotu strony dochodzą poza platformą."],
];

export default function HowItWorks() {
  return <div className="space-y-10 pb-6">
    <section className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-rose-50 p-6 sm:p-10">
      <p className="text-sm font-semibold text-violet-700">MojaSzafa krok po kroku</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Jak to działa?</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Szukasz stylizacji na wyjątkową okazję? Nie musisz kupować czegoś, co założysz tylko raz. Wypożycz, zachwyć i oddaj — z korzyścią dla portfela i planety. Na naszej platformie łączymy osoby, które chcą dzielić się modą i dawać ubraniom kolejne życie.</p>
      <p className="mt-4 text-base text-slate-900"><strong>Zobacz, jak to działa</strong></p>
      <nav aria-label="Wybierz swoją rolę" className="mt-6 flex flex-wrap gap-3">
        <a href="#dla-najemcy" className="rounded-xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700">Chcę wypożyczyć ↓</a>
        <a href="#dla-wlasciciela" className="rounded-xl border border-violet-300 bg-white px-5 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700">Chcę udostępnić ↓</a>
        <a href="#pytania" className="rounded-xl px-5 py-3 text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-violet-700">Najczęstsze pytania</a>
      </nav>
    </section>

    <div className="grid items-start gap-6 lg:grid-cols-2">
      {[{id:"dla-najemcy", title:"Chcę wypożyczyć", subtitle:"Dla najemcy", steps:renterSteps, href:"/listing", cta:"Znajdź ubranie"}, {id:"dla-wlasciciela", title:"Chcę udostępnić", subtitle:"Dla właściciela", steps:ownerSteps, href:"/listing/new", cta:"Wystaw ubranie"}].map(role => <section key={role.id} id={role.id} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">{role.subtitle}</p>
        <h2 className="mt-2 text-2xl font-bold">{role.title}</h2>
        <ol className="my-7 space-y-6">
          {role.steps.map(([title, text], index) => <li key={title} className="flex gap-4">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">{index + 1}</span>
            <div><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div>
          </li>)}
        </ol>
        <Link href={role.href} className="inline-flex rounded-xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-800">{role.cta} →</Link>
      </section>)}
    </div>

    <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 sm:p-7">
      <h2 className="text-xl font-bold">Najpierw sprawdź, potem potwierdź odbiór</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">Potwierdź odbiór dopiero wtedy, gdy przedmiot dotrze do Ciebie i sprawdzisz jego stan. Jeśli wystąpi problem z dostawą, zgłoś go przed potwierdzeniem odbioru.</p>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">Pamiętaj: po potwierdzeniu odbioru najem nie stanowi zabezpieczenia na wypadek uszkodzenia lub braku zwrotu przedmiotu.</p>
    </section>

    <section id="pytania" className="scroll-mt-24">
      <h2 className="text-2xl font-bold">Najczęstsze pytania</h2>
      <p className="mt-2 text-sm text-slate-600">Kliknij pytanie, aby rozwinąć odpowiedź.</p>
      <div className="mt-5 space-y-3">{questions.map(([question, answer]) => <details key={question} className="group rounded-xl border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl p-5 font-medium hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700 [&::-webkit-details-marker]:hidden">
          <span>{question}</span><span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xl text-violet-700"><span className="group-open:hidden">+</span><span className="hidden group-open:inline">−</span></span>
        </summary>
        <p className="px-5 pb-5 text-sm leading-7 text-slate-600">{answer}</p>
      </details>)}</div>
    </section>

    <section className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-lg font-semibold">Potrzebujesz pomocy?</h2><p className="mt-1 text-sm leading-6 text-slate-600">Sprawdź szczegóły w rezerwacji lub skontaktuj się z nami.</p></div>
      <div className="flex flex-wrap gap-4 text-sm font-medium"><Link href="/contact" className="text-violet-700 underline underline-offset-4">Kontakt</Link><Link href="/regulamin" className="text-slate-600 underline underline-offset-4">Regulamin</Link></div>
    </section>
  </div>;
}
