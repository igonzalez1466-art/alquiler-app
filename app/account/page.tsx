import Link from "next/link";
import Stripe from "stripe";
import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { startStripeConnectOnboarding } from "./connectActions";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Brak STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey, {
    apiVersion: "2025-09-30.clover",
  });
}

export default async function AccountPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      stripeAccountId: true,
    },
  });

  if (!user) {
    redirect("/login?callbackUrl=/account");
  }

  let stripeReady = false;
  let stripeNeedsAction = false;

  if (user.stripeAccountId) {
    try {
      const stripe = getStripe();
      const account = await stripe.accounts.retrieve(
        user.stripeAccountId
      );

      stripeReady =
        account.details_submitted === true &&
        account.payouts_enabled === true &&
        account.capabilities?.transfers === "active";

      stripeNeedsAction = !stripeReady;
    } catch (error) {
      console.error(
        "Nie udało się pobrać statusu Stripe Connect:",
        error
      );

      stripeNeedsAction = true;
    }
  }

  return (
    <div className="max-w-xl mx-auto mt-8 space-y-6">
      <h1 className="text-2xl font-bold">Mój profil</h1>

      <div className="rounded border p-4 space-y-2 bg-white">
        <p>
          <strong>Imię:</strong> {user.name ?? "—"}
        </p>

        <p>
          <strong>E-mail:</strong> {user.email ?? "—"}
        </p>
      </div>

      <div className="rounded border p-4 bg-gray-50 space-y-3">
        <h2 className="text-lg font-semibold">Zarządzanie</h2>

        <ul className="space-y-2">
          <li>
            <Link href="/listing?tab=my">
              🧾 Moje ogłoszenia
            </Link>
          </li>

          <li>
            <Link href="/listing/new">
              ➕ Wystaw nowe ogłoszenie
            </Link>
          </li>

          <li>
            <Link href={`/users/${user.id}`}>
              ⭐ Mój profil
            </Link>
          </li>

          <li>
            <Link href="/bookings">
              📅 Moje rezerwacje
            </Link>
          </li>
        </ul>
      </div>

      <div className="rounded border p-4 bg-white space-y-3">
        <h2 className="text-lg font-semibold">Wypłaty</h2>

        {!user.stripeAccountId && (
          <>
            <p className="text-sm text-gray-600">
              Skonfiguruj konto wypłat, aby otrzymywać środki
              z wynajmu swoich przedmiotów.
            </p>

            <form action={startStripeConnectOnboarding}>
              <button
                type="submit"
                className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Skonfiguruj wypłaty
              </button>
            </form>
          </>
        )}

        {user.stripeAccountId && stripeReady && (
          <>
            <div className="rounded border border-green-200 bg-green-50 p-3">
              <p className="font-semibold text-green-800">
                🟢 Wypłaty aktywne
              </p>

              <p className="mt-1 text-sm text-green-700">
                Twoje konto jest skonfigurowane i może otrzymywać
                środki z wynajmu.
              </p>
            </div>
          </>
        )}

        {user.stripeAccountId && stripeNeedsAction && (
          <>
            <div className="rounded border border-yellow-200 bg-yellow-50 p-3">
              <p className="font-semibold text-yellow-800">
                🟡 Konfiguracja wypłat nie jest ukończona
              </p>

              <p className="mt-1 text-sm text-yellow-700">
                Dokończ konfigurację konta Stripe, aby móc
                otrzymywać środki z wynajmu.
              </p>
            </div>

            <form action={startStripeConnectOnboarding}>
              <button
                type="submit"
                className="rounded bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Dokończ konfigurację wypłat
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}