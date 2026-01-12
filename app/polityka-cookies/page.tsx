export default function PolitykaCookiesPage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4 text-gray-800">
      <h1 className="text-3xl font-bold mb-6">Polityka plików cookie</h1>

      <p className="mb-4">
        Niniejsza Polityka plików cookie wyjaśnia, czym są pliki cookie,
        w jaki sposób z nich korzystamy, jakie masz prawa jako użytkownik oraz
        w jaki sposób możesz zarządzać swoimi ustawieniami dotyczącymi plików
        cookie podczas korzystania z naszej strony internetowej.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">1. Czym są pliki cookie?</h2>
      <p className="mb-4">
        Pliki cookie to niewielkie pliki tekstowe przechowywane na Twoim urządzeniu
        (komputerze, smartfonie, tablecie) podczas odwiedzania stron internetowych.
        Ułatwiają one działanie strony, poprawiają komfort użytkowania oraz
        umożliwiają nam analizowanie ruchu i personalizację treści.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">2. Jak korzystamy z plików cookie?</h2>
      <p className="mb-4">Nasza strona korzysta z następujących rodzajów plików cookie:</p>

      <ul className="list-disc ml-6 mb-4 space-y-2">
        <li>
          <strong>Niezbędne pliki cookie:</strong> zapewniają podstawowe funkcje
          działające poprawnie na stronie (logowanie, bezpieczeństwo, nawigacja).
          Te pliki są zawsze aktywne i nie wymagają Twojej zgody.
        </li>
        <li>
          <strong>Analityczne pliki cookie:</strong> pomagają nam zrozumieć, w jaki
          sposób użytkownicy korzystają ze strony, aby móc ją ulepszać. Używamy ich
          tylko wtedy, gdy wyrazisz odpowiednią zgodę.
        </li>
        <li>
          <strong>Marketingowe pliki cookie:</strong> służą do personalizacji
          reklam oraz treści marketingowych. Są aktywne wyłącznie po wyrażeniu zgody.
        </li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">3. Zarządzanie ustawieniami plików cookie</h2>
      <p className="mb-4">
        Podczas pierwszej wizyty na naszej stronie wyświetlany jest baner
        informujący o wykorzystaniu plików cookie. Możesz w nim:
      </p>

      <ul className="list-disc ml-6 mb-4 space-y-2">
        <li>zaakceptować wszystkie pliki cookie,</li>
        <li>odrzucić wszystkie pliki cookie,</li>
        <li>przejść do ustawień szczegółowych i zaznaczyć preferencje.</li>
      </ul>

      <p className="mb-4">
        W każdej chwili możesz zmienić swoje ustawienia, czyszcząc dane przeglądarki
        lub przechodząc ponownie przez baner, jeśli pojawi się ponownie.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">4. Jak długo przechowujemy dane?</h2>
      <p className="mb-4">
        Czas przechowywania plików cookie zależy od ich rodzaju:
      </p>

      <ul className="list-disc ml-6 mb-4 space-y-2">
        <li>
          <strong>Pliki sesyjne</strong> usuwane są po zamknięciu przeglądarki.
        </li>
        <li>
          <strong>Pliki trwałe</strong> pozostają na urządzeniu przez określony
          czas lub do momentu usunięcia ich przez użytkownika.
        </li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">5. Pliki cookie stron trzecich</h2>
      <p className="mb-4">
        W przypadku korzystania z usług zewnętrznych dostawców (np. Google
        Analytics, Meta Pixel) na Twoim urządzeniu mogą być umieszczane pliki
        cookie należące do tych podmiotów. Są one aktywowane tylko wtedy,
        gdy wyrazisz na nie zgodę.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">6. Zmiany w Polityce plików cookie</h2>
      <p className="mb-4">
        Od czasu do czasu możemy aktualizować niniejszą politykę. Najnowsza wersja
        będzie zawsze dostępna na tej stronie.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">7. Kontakt</h2>
      <p className="mb-4">
        Jeśli masz pytania dotyczące naszej polityki plików cookie, możesz się z nami
        skontaktować poprzez formularz na stronie lub e-mail podany w zakładce Kontakt.
      </p>

      <p className="mt-10 text-sm text-gray-500">
        Ostatnia aktualizacja: {new Date().toLocaleDateString("pl-PL")}
      </p>
    </div>
  );
}
