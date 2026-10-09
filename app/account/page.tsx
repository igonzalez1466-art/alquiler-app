import Link from "next/link";
import Stripe from "stripe";
import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { startStripeConnectOnboarding, openStripeConnectDashboard } from "./connectActions";
import PhoneVerification from "./PhoneVerification";
import IdentityVerification from "./IdentityVerification";
import { hasRequiredIdentity, safeIdentityReturn } from "@/app/lib/identityRequirement";
import { identityView } from "@/app/lib/identityVerification";
import PreferredInpostPointForm from "./PreferredInpostPointForm";
import { maskPhone } from "@/app/lib/phoneVerification";
import AccountNextActions from "./AccountNextActions";
import AccountIcon, { type AccountIconName } from "./AccountIcon";

export default async function AccountPage({ searchParams }: { searchParams?: Promise<{ returnTo?: string; payoutError?: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account");
  const params = await searchParams;
  const returnTo = safeIdentityReturn(params?.returnTo);
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, stripeAccountId: true, identityStatus: true, identityVerifiedAt: true, identityLivemode: true, phone: true, phoneVerifiedAt: true, preferredInpostPointCode: true, preferredInpostPointAddress: true },
  });
  if (!user) redirect("/login?callbackUrl=/account");

  let payouts: "missing" | "ready" | "incomplete" | "unavailable" = "missing";
  if (user.stripeAccountId) {
    try {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) throw new Error("unavailable");
      const stripe = new Stripe(key, { apiVersion: "2025-09-30.clover", timeout: 8000, maxNetworkRetries: 0 });
      const account = await stripe.accounts.retrieve(user.stripeAccountId);
      payouts = account.details_submitted && account.payouts_enabled && account.capabilities?.transfers === "active" ? "ready" : "incomplete";
    } catch { payouts = "unavailable"; }
  }
  const identity = identityView(user);
  const identityReady = hasRequiredIdentity(user);
  const phoneReady = !!user.phoneVerifiedAt;
  const ready = identityReady && phoneReady;
  const completed = Number(identityReady) + Number(phoneReady);
  const initials = (user.name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("") || user.email?.[0] || "M").toUpperCase();
  const shortcuts: { title: string; description: string; href: string; icon: AccountIconName }[] = [
    { title: "Moje ogłoszenia", description: "Dostępność i opublikowane przedmioty", href: "/listing?tab=my", icon: "listing" },
    { title: "Moje szkice", description: "Zapisane ogłoszenia przed publikacją", href: "/listing?tab=my&drafts=1", icon: "edit" },
    { title: "Moje rezerwacje", description: "Najem, dostawa i zwrot przedmiotów", href: "/bookings", icon: "calendar" },
    { title: "Moje zgłoszenia", description: "Problemy i uzgodnione rozwiązania", href: "/account/incidents", icon: "flag" },
    { title: "Historia transakcji", description: "Płatności i rozliczenia", href: "/account/transactions", icon: "receipt" },
    { title: "Mój profil publiczny", description: "Zobacz swój profil i opinie", href: `/users/${user.id}`, icon: "star" },
  ];

  return <div className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:py-10">
    <header className="surface-card relative overflow-hidden p-6 sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-violet-100/60 blur-3xl" />
      <div className="relative grid gap-7 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-700">MojaSzafa · Twoja przestrzeń</p>
          <div className="mt-5 flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-xl font-bold text-violet-800">{initials}</span>
            <div className="min-w-0"><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Moje konto</h1><p className="mt-1 break-words font-medium text-slate-700">{user.name || "Witaj w MojaSzafa"}</p><p className="mt-1 break-all text-sm text-slate-500">{user.email}</p></div>
          </div>
          <p className="mt-5 max-w-md text-sm leading-6 text-slate-500">Zarządzaj weryfikacją, dostawą i wypłatami. Wszystko, czego potrzebujesz do wynajmu, w jednym miejscu.</p>
        </div>
        <div className={`rounded-2xl border p-5 ${ready && !identity.testMode ? "border-emerald-200 bg-emerald-50/80" : ready ? "border-violet-200 bg-violet-50/80" : "border-slate-200 bg-slate-50/90"}`}>
          <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status konta</span><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{completed}/2 ukończone</span></div>
          <h2 className="mt-3 text-lg font-semibold text-slate-900">{ready ? identity.testMode ? "Konto gotowe w trybie testowym" : "Możesz publikować i rezerwować" : !identityReady ? "Zacznij od weryfikacji tożsamości" : "Jeszcze tylko numer telefonu"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{ready ? identity.testMode ? "Weryfikacja jest symulowana. Możesz sprawdzić publikację i rezerwacje w środowisku testowym." : "Weryfikacje zostały ukończone. Wystaw przedmiot albo znajdź coś dla siebie." : !identityReady ? "Zweryfikuj tożsamość, aby publikować ogłoszenia i wysyłać prośby o rezerwację." : "Możesz już publikować. Zweryfikuj telefon, aby również rezerwować i akceptować rezerwacje."}</p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true"><div className="h-full rounded-full bg-violet-600" style={{ width: `${completed * 50}%` }} /></div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={ready ? returnTo || "/listing/new" : !identityReady ? "#tozsamosc" : "#telefon"} className="ui-btn ui-btn-primary">{ready ? returnTo ? "Wróć i kontynuuj" : "Wystaw przedmiot" : !identityReady ? "Zweryfikuj tożsamość" : "Zweryfikuj telefon"}<AccountIcon name="arrow" className="h-4 w-4" /></Link>
            {ready && <Link href="/listing" className="ui-btn">Przeglądaj ogłoszenia</Link>}
          </div>
        </div>
      </div>
    </header>

    <nav aria-label="Sekcje konta" className="flex flex-wrap gap-2 text-sm"><a href="#weryfikacje" className="ui-btn">Weryfikacje</a><a href="#wyplaty" className="ui-btn">Wypłaty</a><a href="#inpost" className="ui-btn">Dostawa</a><a href="#skroty" className="ui-btn">Szybkie przejścia</a></nav>

    <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
      <div className="min-w-0 space-y-6">
        <section id="weryfikacje" className="surface-card scroll-mt-24 overflow-hidden" aria-labelledby="verification-title">
          <div className="flex items-start gap-3 border-b border-slate-100 p-5 sm:p-6"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><AccountIcon name="shield" /></span><div><h2 id="verification-title" className="text-lg font-semibold text-slate-900">Weryfikacje konta</h2><p className="mt-1 text-sm text-slate-500">Jedna konfiguracja dla najemcy i właściciela.</p></div></div>
          <IdentityVerification initial={identity} returnTo={returnTo} requirementSatisfied={identityReady} />
          <PhoneVerification verified={phoneReady} maskedPhone={maskPhone(user.phone)} returnTo={returnTo} />
        </section>
        <PreferredInpostPointForm code={user.preferredInpostPointCode} address={user.preferredInpostPointAddress} geowidgetToken={process.env.INPOST_GEOWIDGET_TOKEN?.trim() || null} />
      </div>
      <div className="min-w-0 space-y-6">
        <AccountNextActions />
        <section id="wyplaty" className="surface-card scroll-mt-24 space-y-4 p-5 sm:p-6" aria-labelledby="payout-title">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><AccountIcon name="wallet" /></span><div><p className="text-xs font-semibold text-slate-500">Dla właściciela</p><h2 id="payout-title" className="mt-0.5 text-lg font-semibold text-slate-900">Wypłaty za wynajem</h2></div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${payouts === "ready" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{payouts === "ready" ? "Aktywne" : payouts === "missing" ? "Do konfiguracji" : payouts === "unavailable" ? "Sprawdź status" : "Do uzupełnienia"}</span></div>
          <p className="text-sm leading-6 text-slate-600">{payouts === "ready" ? "Twoje konto może otrzymywać środki za wynajem. Szczegóły wypłat znajdziesz w panelu Stripe." : payouts === "missing" ? "Dodaj dane do wypłat, aby otrzymywać wynagrodzenie za swoje przedmioty." : payouts === "unavailable" ? "Nie udało się teraz sprawdzić statusu wypłat. Możesz otworzyć panel Stripe lub spróbować ponownie później." : "Uzupełnij wymagane dane w Stripe, aby otrzymywać środki za wynajem."}</p>
          {params?.payoutError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Nie udało się otworzyć panelu wypłat. Spróbuj ponownie za chwilę.</p>}
          <form action={payouts === "ready" || payouts === "unavailable" ? openStripeConnectDashboard : startStripeConnectOnboarding}><button type="submit" className="ui-btn ui-btn-primary">{payouts === "ready" || payouts === "unavailable" ? "Zarządzaj wypłatami" : payouts === "missing" ? "Skonfiguruj wypłaty" : "Dokończ konfigurację"}<AccountIcon name="arrow" className="h-4 w-4" /></button></form>
          <details className="rounded-xl border border-slate-100 p-3 text-sm"><summary className="cursor-pointer font-medium text-slate-600">Jak działają wypłaty?</summary><p className="mt-3 leading-6 text-slate-500">Konfiguracja wypłat jest potrzebna, gdy udostępniasz własne przedmioty. Wypłatę uruchamiamy po potwierdzeniu odbioru przez najemcę lub uzgodnieniu rozwiązania problemu z dostawą.</p></details>
        </section>
      </div>
    </div>

    <section id="skroty" className="scroll-mt-24" aria-labelledby="shortcuts-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 id="shortcuts-title" className="text-xl font-semibold text-slate-900">Szybkie przejścia</h2><p className="mt-1 text-sm text-slate-500">Twoje przedmioty, rezerwacje i rozliczenia.</p></div><Link href="/listing/new" className="ui-btn">Dodaj ogłoszenie<AccountIcon name="arrow" className="h-4 w-4" /></Link></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shortcuts.map(item => <Link key={item.href} href={item.href} className="surface-card group flex items-center gap-4 p-5 transition hover:border-violet-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"><span className="shrink-0 rounded-xl bg-violet-50 p-3 text-violet-700"><AccountIcon name={item.icon} /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900 group-hover:text-violet-700">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span></span><AccountIcon name="arrow" className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-violet-700" /></Link>)}</div>
    </section>
    <p className="flex flex-wrap gap-x-5 gap-y-2 px-1 text-sm text-slate-500"><Link href="/jak-to-dziala" className="hover:text-violet-700">Jak to działa?</Link><Link href="/contact" className="hover:text-violet-700">Potrzebujesz pomocy?</Link><Link href="/polityka-prywatnosci" className="hover:text-violet-700">Prywatność</Link></p>
  </div>;
}
