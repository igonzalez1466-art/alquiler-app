import Image from "next/image";

export default function Home() {
  return (
    <>
      {/* === HERO FULL BLEED (IGNORA EL LAYOUT CENTRADO) === */}
      <section className="relative h-[calc(100vh-72px)] w-screen overflow-hidden left-1/2 -translate-x-1/2">
        <Image
          src="/hero.jpg"
          alt="Hero"
          fill
          priority
          className="object-cover"
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-black/30" />

        {/* Contenido */}
        <div className="absolute inset-0 z-10 flex items-center">
          <div className="max-w-6xl mx-auto px-6">
            <div className="bg-white rounded-xl p-6 md:p-8 shadow-xl max-w-md">
              <h1 className="text-2xl md:text-3xl font-bold mb-4">
                Czas na zmiany w szafie?
              </h1>

              <a
                href="/listing/new"
                className="block w-full text-center bg-violet-700 hover:bg-violet-800 text-white font-semibold py-3 rounded-lg mb-3 transition"
              >
                Dodaj ogłoszenie
              </a>

              <a
                href="/listing"
                className="block text-center text-violet-700 font-medium"
              >
                Przeglądaj ogłoszenia
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* === RESTO DE LA PÁGINA === */}
      <main className="bg-gray-50">
        {/* Jak to działa */}
        <section className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold mb-6 text-center">
            Jak to działa?
          </h2>

          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="text-4xl mb-3">📸</div>
              <h3 className="font-semibold mb-2">Dodaj ogłoszenie</h3>
              <p className="text-gray-600 text-sm">
                Zrób zdjęcie, dodaj opis i udostępnij przedmiot innym.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="text-4xl mb-3">🤝</div>
              <h3 className="font-semibold mb-2">Ustal szczegóły</h3>
              <p className="text-gray-600 text-sm">
                Osoby zainteresowane kontaktują się z Tobą, aby ustalić odbiór
                lub sposób przekazania.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="text-4xl mb-3">🔄</div>
              <h3 className="font-semibold mb-2">Daj rzeczom drugie życie</h3>
              <p className="text-gray-600 text-sm">
                Twoje rzeczy nie leżą bezczynnie — mogą dalej służyć komuś innemu.
              </p>
            </div>
          </div>
        </section>

        {/* === KATEGORIE === */}
        <section className="max-w-6xl mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold mb-6">
            Najpopularniejsze kategorie
          </h2>

          <div className="flex justify-center">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { name: "Sukienki", garmentType: "VESTIDO", img: "/cat-dress.jpg" },
                { name: "Garnitur", garmentType: "TRAJE", img: "/cat-men.jpg" },
                { name: "Buty", garmentType: "ZAPATO", img: "/cat-accessories.jpg" },
              ].map((cat) => (
<a
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
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
