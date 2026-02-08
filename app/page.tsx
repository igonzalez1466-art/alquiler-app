import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <>
      {/* === HERO FULL BLEED (IGNORA EL LAYOUT CENTRADO) === */}
      <section className="relative h-[calc(100vh-72px)] w-screen overflow-hidden left-1/2 -translate-x-1/2">
        <Image src="/hero.jpg" alt="Hero" fill priority className="object-cover" />

        {/* Overlay */}
        <div className="absolute inset-0 bg-black/30" />

        {/* Contenido */}
        <div className="absolute inset-0 z-10 flex items-center">
          <div className="max-w-6xl mx-auto px-6">
            <div className="bg-white rounded-xl p-6 md:p-8 shadow-xl max-w-md">
              <h1 className="text-2xl md:text-3xl font-bold mb-3">
                Zarabiaj na ubraniach, których nie nosisz
              </h1>

              <p className="text-gray-600 text-sm mb-4">
                Wypożyczaj ubrania między osobami. Daj im drugie życie, oszczędzaj i
                zmniejszaj ślad środowiskowy mody.
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs bg-gray-100 rounded-full px-3 py-1">💸 Dodatkowy zarobek</span>
                <span className="text-xs bg-gray-100 rounded-full px-3 py-1">♻️ Drugie życie ubrań</span>
                <span className="text-xs bg-gray-100 rounded-full px-3 py-1">🌿 Mniej kupowania</span>
              </div>

              <Link
                href="/listing/new"
                className="block w-full text-center bg-violet-700 hover:bg-violet-800 text-white font-semibold py-3 rounded-lg mb-3 transition"
              >
                Dodaj ubranie i zacznij zarabiać
              </Link>

              <Link
                href="/listing"
                className="block text-center text-violet-700 font-medium"
              >
                Zobacz dostępne ubrania →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* === RESTO DE LA PÁGINA === */}
      <main className="bg-gray-50">
        {/* Jak to działa */}
        <section className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold mb-6 text-center">Jak to działa?</h2>

          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="text-4xl mb-3">📸</div>
              <h3 className="font-semibold mb-2">Dodaj ogłoszenie</h3>
              <p className="text-gray-600 text-sm">
                Zrób zdjęcia, dodaj opis i ustal cenę wypożyczenia.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="text-4xl mb-3">🤝</div>
              <h3 className="font-semibold mb-2">Ustal szczegóły</h3>
              <p className="text-gray-600 text-sm">
                Zainteresowane osoby kontaktują się z Tobą, a Ty ustalasz odbiór i zwrot.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="text-4xl mb-3">♻️</div>
              <h3 className="font-semibold mb-2">Daj ubraniom drugie życie</h3>
              <p className="text-gray-600 text-sm">
                Ty zarabiasz, ktoś oszczędza, a moda ma mniejszy wpływ na środowisko.
              </p>
            </div>
          </div>
        </section>

        {/* === KATEGORIE === */}
        <section className="max-w-6xl mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold mb-6">Najpopularniejsze kategorie</h2>

          <div className="flex justify-center">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { name: "Sukienki", garmentType: "VESTIDO", img: "/cat-dress.jpg" },
                { name: "Garnitury", garmentType: "TRAJE", img: "/cat-men.jpg" },
                { name: "Buty", garmentType: "ZAPATO", img: "/cat-accessories.jpg" },
              ].map((cat) => (
                <Link
                  key={cat.garmentType}
                  href={`/listing?garmentType=${cat.garmentType}`}
                  className="group rounded-2xl overflow-hidden shadow-sm hover:shadow-md bg-white transition block"
                >
                  <div className="h-32 md:h-40 w-full overflow-hidden">
                    <Image
                      src={cat.img}
                      alt={cat.name}
                      width={400}
                      height={300}
                      className="h-full w-full object-cover group-hover:scale-105 transition"
                    />
                  </div>
                  <div className="p-3 text-center font-medium text-gray-800">
                    {cat.name}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
