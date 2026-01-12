export default function ONasPage() {
  return (
    <main className="max-w-3xl mx-auto p-6 leading-relaxed text-gray-700">

      <h1 className="text-3xl font-bold mb-6">O nas</h1>

      <p className="mb-4">
        Witamy w <strong>MojaSzafa</strong> — platformie stworzonej po to, aby każdy mógł w prosty, 
        bezpieczny i wygodny sposób <strong>wypożyczać swoje ubrania i przedmioty innym osobom</strong>. 
        Wierzymy w mądrzejszą, bardziej zrównoważoną i dostępną formę konsumpcji, w której każda rzecz 
        może zyskać nowe życie i kolejne zastosowanie.
      </p>

      <p className="mb-6">
        <strong>MojaSzafa</strong> powstała z bardzo prostej idei:
      </p>

      <blockquote className="border-l-4 border-blue-500 pl-4 italic mb-6">
        Jeśli czegoś nie używasz, ktoś inny może potrzebować tego właśnie dziś.
      </blockquote>

      <p className="mb-6">
        U nas właściciele i użytkownicy łączą się bezpośrednio, bez zbędnych pośredników, aby w łatwy 
        i przejrzysty sposób dzielić się przedmiotami. Naszym celem jest stworzenie przestrzeni, w której:
      </p>

      <ul className="space-y-3 mb-8">
        <li className="flex items-start gap-2">
          <span className="text-blue-600 text-xl">•</span>
          <span>
            <strong>Moda staje się bardziej zrównoważona</strong>, ograniczając niepotrzebne zakupy.
          </span>
        </li>

        <li className="flex items-start gap-2">
          <span className="text-yellow-600 text-xl">•</span>
          <span>
            <strong>Ludzie ufają innym ludziom</strong>, dzięki ocenom i bezpośredniej komunikacji.
          </span>
        </li>

        <li className="flex items-start gap-2">
          <span className="text-green-600 text-xl">•</span>
          <span>
            <strong>Rzeczy krążą dalej</strong>, zamiast leżeć nieużywane w szafie lub w domu.
          </span>
        </li>
      </ul>

      <p className="mb-4">
        Codziennie pracujemy nad tym, aby poprawiać doświadczenie użytkowników i ułatwiać 
        proces wypożyczania między osobami prywatnymi.
      </p>

      <p className="font-semibold">
        Dziękujemy, że tworzysz z nami społeczność, która wybiera bardziej świadomy i 
        współdzielony sposób korzystania z rzeczy.
      </p>

      <p className="font-bold text-blue-700 mt-2">
        Razem sprawiamy, że dzielenie się staje się nową formą korzystania.
      </p>
    </main>
  );
}
