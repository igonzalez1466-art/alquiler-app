export default function RegulaminPage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4 text-gray-800">
      <h1 className="text-3xl font-bold mb-6">Regulamin serwisu</h1>

      <p className="mb-4">
        Niniejszy regulamin określa zasady korzystania z platformy oraz prawa i
        obowiązki jej użytkowników. Korzystając z serwisu, akceptujesz poniższe
        postanowienia.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">1. Definicje</h2>
      <p className="mb-4">W niniejszym regulaminie:</p>

      <ul className="list-disc ml-6 mb-4 space-y-2">
        <li><strong>Serwis</strong> – platforma internetowa umożliwiająca dodawanie i rezerwację ogłoszeń.</li>
        <li><strong>Użytkownik</strong> – osoba posiadająca konto w serwisie.</li>
        <li><strong>Ogłoszenie</strong> – oferta zamieszczona przez użytkownika.</li>
        <li><strong>Administrator</strong> – właściciel i operator serwisu.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">2. Warunki korzystania z serwisu</h2>
      <ul className="list-disc ml-6 mb-4 space-y-2">
        <li>Utworzenie konta wymaga podania prawidłowych danych.</li>
        <li>Użytkownik jest zobowiązany do zachowania poufności danych logowania.</li>
        <li>Zabronione jest publikowanie treści niezgodnych z prawem.</li>
        <li>Administrator może zawiesić konto naruszające regulamin.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">3. Dodawanie ogłoszeń</h2>
      <ul className="list-disc ml-6 mb-4 space-y-2">
        <li>Użytkownik ponosi pełną odpowiedzialność za treść publikowanego ogłoszenia.</li>
        <li>Ogłoszenia nie mogą naruszać praw osób trzecich.</li>
        <li>Administrator ma prawo usuwać ogłoszenia niezgodne z regulaminem.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">4. Rezerwacje</h2>
      <ul className="list-disc ml-6 mb-4 space-y-2">
        <li>Rezerwacja stanowi zobowiązanie między użytkownikami.</li>
        <li>Serwis nie ponosi odpowiedzialności za niewłaściwą realizację umowy między stronami.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">5. Odpowiedzialność</h2>
      <ul className="list-disc ml-6 mb-4 space-y-2">
        <li>Administrator nie odpowiada za treści publikowane przez użytkowników.</li>
        <li>Serwis nie gwarantuje nieprzerwanego dostępu do platformy.</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">6. Płatności</h2>
      <p className="mb-4">
        Jeśli korzystasz z płatnych funkcji serwisu, płatności mogą być obsługiwane przez
        zewnętrznych operatorów zgodnie z ich regulaminem.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">7. Rozwiązanie umowy</h2>
      <p className="mb-4">
        Użytkownik może w każdej chwili usunąć swoje konto. Administrator zastrzega sobie
        prawo do usunięcia kont naruszających regulamin.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">8. Zmiany regulaminu</h2>
      <p className="mb-4">
        Administrator może zmienić regulamin. O zmianach użytkownicy zostaną poinformowani
        z odpowiednim wyprzedzeniem.
      </p>

      <p className="mt-10 text-sm text-gray-500">
        Ostatnia aktualizacja: {new Date().toLocaleDateString("pl-PL")}
      </p>
    </div>
  );
}
