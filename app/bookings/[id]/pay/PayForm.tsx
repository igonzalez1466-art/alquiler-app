"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

function InnerPayForm() {
  const stripe = useStripe();
  const elements = useElements();

  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function handleSubmit() {
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        // Opcional si quieres soportar redirect methods mejor
        // return_url: `${window.location.origin}/bookings`
      },
    });

    setProcessing(false);

    if (result.error) {
      setError(result.error.message ?? "Wystąpił błąd podczas płatności");
      return;
    }

    // Si no hubo error, el PI quedó confirmado o en proceso
    window.location.href = "/bookings";
  }

  return (
    <div className="max-w-md">
      <h2 className="text-lg font-semibold mb-2">Zapłać za rezerwację</h2>
      <p className="text-sm text-gray-600 mb-4">
        Ta kwota obejmuje koszt wynajmu oraz kaucję zwrotną.
      </p>

      <PaymentElement />

      <button
        type="button"
        className="mt-4 px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        disabled={!stripe || !elements || processing}
        onClick={handleSubmit}
      >
        {processing ? "Przetwarzanie..." : "Zapłać teraz"}
      </button>

      {error && <p className="mt-2 text-red-600">{error}</p>}
    </div>
  );
}

export default function PayForm({ clientSecret }: { clientSecret: string }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <InnerPayForm />
    </Elements>
  );
}