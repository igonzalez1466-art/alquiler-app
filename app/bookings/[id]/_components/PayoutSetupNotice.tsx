export default function PayoutSetupNotice({ isOwner }: { isOwner: boolean }) {
  return <div className="rounded border border-amber-200 bg-amber-50 p-3 space-y-2 text-sm text-amber-900" role="alert">
    {isOwner ? <>
      <p>Aby dokończyć rozliczenie rezerwacji, skonfiguruj wypłaty w „Moje konto”. Po zakończeniu konfiguracji wróć do tej rezerwacji, odśwież ją i ponów rozliczenie.</p>
      <a href="/account#wyplaty" target="_blank" rel="noopener noreferrer" className="inline-block rounded bg-zinc-900 px-4 py-2 font-semibold text-white">Skonfiguruj wypłaty</a>
      <p className="text-xs">Otworzy się nowa karta. Rezerwacja pozostanie tutaj.</p>
    </> : <p>Właściciel musi skonfigurować konto wypłat w „Moje konto”. Skontaktuj się z nim przez czat rezerwacji. Po aktywacji wypłat będzie można ponowić rozliczenie.</p>}
  </div>;
}
