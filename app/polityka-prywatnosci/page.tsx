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
        Administratorem danych osobowych jest właściciel serwisu z siedzibą w Polsce.
        Kontakt w sprawach związanych z ochroną danych osobowych możliwy jest poprzez formularz kontaktowy lub dane dostępne w zakładce „Kontakt”.

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
        <li>umożliwienie kontaktu i rezerwacji pomiędzy użytkownikami,</li>
        <li>zapewnienie bezpieczeństwa serwisu oraz zapobieganie nadużyciom,</li>
        <li>podstawowa analiza statystyczna działania platformy,</li>
        <li>marketing — wyłącznie po wyrażeniu odpowiedniej zgody,</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">4. Podstawy prawne przetwarzania</h2>
      <p className="mb-4">Dane osobowe przetwarzane są na podstawie:</p>

      <ul className="list-disc ml-6 mb-4 space-y-2">
        <li>art. 6 ust. 1 lit. b RODO — wykonanie umowy (korzystanie z serwisu),</li>
        <li>art. 6 ust. 1 lit. f RODO — prawnie uzasadniony interes administratora (bezpieczeństwo serwisu),</li>
        <li>art. 6 ust. 1 lit. a RODO — zgoda użytkownika (marketing, cookies).</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">5. Odbiorcy danych</h2>
      <p className="mb-4">Dane mogą być udostępniane:</p>

      <ul className="list-disc ml-6 mb-4 space-y-2">
        <li>dostawcom usług hostingu i infrastruktury IT,</li>
        <li>dostawcom narzędzi analitycznych — wyłącznie po wyrażeniu zgody,</li>
        <li>organom publicznym na podstawie obowiązujących przepisów prawa.</li>
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
        <li>Użytkownik ma prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (UODO).</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">7. Przechowywanie danych</h2>
      <p className="mb-4">
        Dane osobowe przechowywane są przez okres trwania konta użytkownika oraz po jego usunięciu przez czas niezbędny do realizacji obowiązków prawnych lub zabezpieczenia roszczeń.
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
