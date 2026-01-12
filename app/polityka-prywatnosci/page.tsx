export default function PolitykaPrywatnosciPage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4 text-gray-800">
      <h1 className="text-3xl font-bold mb-6">Polityka prywatności</h1>

      <p className="mb-4">
        Niniejsza Polityka prywatności określa zasady przetwarzania danych
        osobowych użytkowników naszej platformy oraz informuje o prawach
        przysługujących osobom, których dane dotyczą.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">1. Administrator danych</h2>
      <p className="mb-4">
        Administratorem danych osobowych jest właściciel serwisu.  
        Kontakt w sprawach związanych z ochroną danych osobowych można uzyskać
        poprzez formularz kontaktowy lub dane kontaktowe dostępne w zakładce „Kontakt”.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">2. Zakres przetwarzanych danych</h2>
      <p className="mb-4">Przetwarzamy dane osobowe niezbędne do korzystania z naszej platformy, w tym:</p>

      <ul className="list-disc ml-6 mb-4 space-y-2">
        <li>imię i nazwisko,</li>
        <li>adres e-mail,</li>
        <li>numer telefonu (opcjonalnie),</li>
        <li>dane logowania,</li>
        <li>adres IP oraz dane techniczne przeglądarki,</li>
        <li>dane dotyczące rezerwacji i wystawianych ogłoszeń.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">3. Cele przetwarzania danych</h2>
      <p className="mb-4">Dane osobowe przetwarzamy w następujących celach:</p>

      <ul className="list-disc ml-6 mb-4 space-y-2">
        <li>utworzenie i obsługa konta użytkownika,</li>
        <li>realizacja rezerwacji oraz komunikacja z innymi użytkownikami,</li>
        <li>obsługa płatności,</li>
        <li>zapewnienie bezpieczeństwa i zapobieganie nadużyciom,</li>
        <li>personalizacja funkcji serwisu,</li>
        <li>analiza statystyczna działania platformy,</li>
        <li>marketing — wyłącznie po wyrażeniu odpowiedniej zgody.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">4. Podstawy prawne przetwarzania</h2>
      <p className="mb-4">Dane przetwarzamy na podstawie:</p>

      <ul className="list-disc ml-6 mb-4 space-y-2">
        <li>art. 6 ust. 1 lit. b RODO — wykonanie umowy,</li>
        <li>art. 6 ust. 1 lit. c RODO — obowiązki prawne,</li>
        <li>art. 6 ust. 1 lit. f RODO — uzasadniony interes administratora,</li>
        <li>art. 6 ust. 1 lit. a RODO — zgoda użytkownika.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">5. Odbiorcy danych</h2>
      <p className="mb-4">Dane mogą być udostępniane:</p>

      <ul className="list-disc ml-6 mb-4 space-y-2">
        <li>dostawcom usług płatniczych,</li>
        <li>dostawcom usług hostingu,</li>
        <li>firmom analitycznym lub marketingowym — wyłącznie za zgodą,</li>
        <li>organom państwowym na podstawie przepisów prawa.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">6. Prawa użytkownika</h2>
      <p className="mb-4">Każdy użytkownik ma prawo do:</p>

      <ul className="list-disc ml-6 mb-4 space-y-2">
        <li>dostępu do swoich danych,</li>
        <li>sprostowania danych,</li>
        <li>usunięcia danych („prawo do bycia zapomnianym”),</li>
        <li>ograniczenia przetwarzania,</li>
        <li>przenoszenia danych,</li>
        <li>wniesienia sprzeciwu wobec przetwarzania,</li>
        <li>wycofania zgody w dowolnym momencie.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">7. Przechowywanie danych</h2>
      <p className="mb-4">
        Dane przechowujemy przez okres nie dłuższy niż jest to konieczne do
        realizacji celów przetwarzania lub do momentu zgłoszenia żądania usunięcia danych.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">8. Pliki cookie</h2>
      <p className="mb-4">
        Szczegółowe informacje na temat plików cookie znajdują się w naszej{" "}
        <a href="/polityka-cookies" className="underline font-semibold">
          Polityce plików cookie
        </a>.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">9. Zmiany w Polityce prywatności</h2>
      <p className="mb-4">
        Zastrzegamy sobie prawo do wprowadzenia zmian w niniejszej polityce.
        Aktualna wersja będzie zawsze dostępna na tej stronie.
      </p>

      <p className="mt-10 text-sm text-gray-500">
        Ostatnia aktualizacja: {new Date().toLocaleDateString("pl-PL")}
      </p>
    </div>
  );
}
