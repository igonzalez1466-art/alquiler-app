import Image from "next/image";
import Link from "next/link";

const steps = [
  { number: "01", title: "Wybierz", text: "Znajdź ubranie, sprawdź szczegóły i wybierz termin." },
  { number: "02", title: "Wypożycz", text: "Zapłać po akceptacji rezerwacji i sprawdź przedmiot przy odbiorze." },
  { number: "03", title: "Zwróć", text: "Uzgodnij zwrot i zapisz szczegóły w rezerwacji." },
];
export default function Home() {
  return <div className="space-y-16 pb-8 sm:space-y-20">
    <section className="relative isolate overflow-hidden rounded-[2rem] bg-slate-900">
      <Image src="/hero.jpg" alt="" fill priority sizes="(max-width: 1152px) 100vw, 1152px" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/50 via-slate-950/10 to-transparent" />
      <div className="relative flex min-h-[570px] items-center px-4 py-8 sm:min-h-[620px] sm:px-10 sm:py-12">
        <div className="max-w-lg rounded-3xl bg-white/95 p-6 shadow-xl backdrop-blur-sm sm:p-9">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[.18em] text-violet-700">Twoja szafa. Więcej możliwości.</p>
          <h1 className="text-3xl font-bold leading-[1.12] text-slate-950 sm:text-4xl">Wypożyczaj ubrania.<span className="mt-2 block">Zarabiaj na swojej szafie.</span></h1>
          <p className="mt-5 text-sm leading-6 text-slate-600 sm:text-base">Na wyjątkową okazję. Na jeden weekend. Znajdź coś dla siebie albo udostępnij ubranie, które czeka w szafie.</p>
          <div className="my-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700">💸 Dodatkowy zarobek</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700">♻️ Drugie życie ubrań</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700">🌿 Mniej kupowania</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs text-slate-700"><svg aria-hidden="true" viewBox="0 0 32 32" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="16" cy="8" r="3.5"/><circle cx="6.5" cy="10" r="3"/><circle cx="25.5" cy="10" r="3"/><path d="M9 28v-5a7 7 0 0 1 14 0v5H9ZM8 15.5A5.5 5.5 0 0 0 1 21v3h5M24 15.5a5.5 5.5 0 0 1 7 5.5v3h-5"/></svg>Zaufana społeczność</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/listing" className="ui-btn ui-btn-primary">Wypożycz ubranie →</Link>
            <Link href="/listing/new" className="ui-btn border-violet-300 text-violet-700">Wystaw ubranie</Link>
            <Link href="/jak-to-dziala" className="ui-btn sm:col-span-2">Jak to działa? →</Link>
          </div>
        </div>
      </div>
    </section>

    <section aria-labelledby="home-steps" className="space-y-7">
      <div className="text-center"><p className="text-xs font-semibold uppercase tracking-widest text-violet-700">Od wyboru do zwrotu</p><h2 id="home-steps" className="mt-2 text-2xl font-bold sm:text-3xl">Trzy proste kroki</h2></div>
      <div className="grid gap-5 md:grid-cols-3">{steps.map(step => <article key={step.number} className="surface-card p-6 sm:p-7"><span className="text-sm font-semibold text-violet-700">{step.number}</span><h3 className="mt-4 text-xl font-semibold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{step.text}</p></article>)}</div>
      <div className="text-center"><Link href="/jak-to-dziala" className="text-sm font-semibold text-violet-700 underline underline-offset-4">Zobacz, jak to działa →</Link></div>
    </section>

    <section aria-labelledby="home-categories" className="space-y-7">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-violet-700">Znajdź swój styl</p><h2 id="home-categories" className="mt-2 text-2xl font-bold sm:text-3xl">Przeglądaj kategorie</h2></div>
      <div className="grid gap-5 sm:grid-cols-3">{[
        {name:"Sukienki", garmentType:"VESTIDO", img:"/cat-dress.jpg"},
        {name:"Garnitury", garmentType:"TRAJE", img:"/cat-men.jpg"},
        {name:"Buty", garmentType:"ZAPATO", img:"/cat-accessories.jpg"},
      ].map(cat => <Link key={cat.garmentType} href={"/listing?garmentType=" + cat.garmentType} className="group relative aspect-[4/3] overflow-hidden rounded-3xl bg-slate-200 sm:aspect-[4/5]">
        <Image src={cat.img} alt={cat.name} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover transition duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-between p-6 text-xl font-semibold text-white">{cat.name}<span aria-hidden="true">↗</span></span>
      </Link>)}</div>
    </section>
  </div>;
}
