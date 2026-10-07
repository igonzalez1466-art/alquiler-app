import Link from "next/link";
export default async function AuthError({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error === "AccessDenied" ? "Nie udało się potwierdzić dostępu do konta." : error === "OAuthAccountNotLinked" ? "Zaloguj się metodą używaną wcześniej dla tego konta." : "Nie udało się zalogować. Spróbuj ponownie.";
  return <div className="mx-auto mt-10 max-w-sm space-y-4"><h1 className="text-xl font-bold">Problem z logowaniem</h1><p role="alert">{message}</p><Link href="/login" className="inline-block rounded bg-indigo-600 px-4 py-2 text-white">Wróć do logowania</Link></div>;
}
