"use client";
console.log("PK", process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);


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

function InnerPayForm({
  rentClientSecret,
  depositClientSecret,
}: {
  rentClientSecret: string;
  depositClientSecret: string;
}) {
  const [step, setStep] = useState<"rent" | "deposit" | "done">("rent");
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const stripe = useStripe();
  const elements = useElements();

  async function confirmCurrentPayment() {
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // si quieres redirecciones, pon return_url
        // return_url: window.location.href
      },
      redirect: "if_required",
    });

    setProcessing(false);

    if (result.error) {
      setError(result.error.message ?? "Error confirmando el pago");
      return false;
    }
    return true;
  }

  return (
    <div className="max-w-md">
      {step === "rent" && (
        <>
          <h2 className="text-lg font-semibold mb-2">Pagar alquiler</h2>
          <p className="text-sm text-gray-600 mb-4">
            Este cargo se cobrará ahora.
          </p>

          <PaymentElement />

          <button
            className="mt-4 px-4 py-2 rounded bg-black text-white disabled:opacity-50"
            disabled={!stripe || !elements || processing}
            onClick={async () => {
              const ok = await confirmCurrentPayment();
              if (ok) setStep("deposit");
            }}
          >
            {processing ? "Procesando..." : "Pagar alquiler"}
          </button>

          {error && <p className="mt-2 text-red-600">{error}</p>}
        </>
      )}

      {step === "deposit" && (
        <DepositStep
          depositClientSecret={depositClientSecret}
          onDone={() => setStep("done")}
        />
      )}

      {step === "done" && (
        <div className="p-4 rounded border">
          <h2 className="text-lg font-semibold">✅ Pago completado</h2>
          <p className="text-sm text-gray-600">
            Alquiler cobrado y fianza bloqueada (no cobrada).
          </p>
        </div>
      )}
    </div>
  );
}

function DepositStep({
  depositClientSecret,
  onDone,
}: {
  depositClientSecret: string;
  onDone: () => void;
}) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: depositClientSecret }}>
      <DepositInner onDone={onDone} />
    </Elements>
  );
}

function DepositInner({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function confirmDepositHold() {
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    setProcessing(false);

    if (result.error) {
      setError(result.error.message ?? "Error confirmando la fianza");
      return;
    }

    onDone();
  }

  return (
    <>
      <h2 className="text-lg font-semibold mb-2">Bloquear fianza</h2>
      <p className="text-sm text-gray-600 mb-4">
        Esto no se cobra. Solo se bloqueará temporalmente.
      </p>

      <PaymentElement />

      <button
        className="mt-4 px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        disabled={!stripe || !elements || processing}
        onClick={confirmDepositHold}
      >
        {processing ? "Procesando..." : "Bloquear fianza"}
      </button>

      {error && <p className="mt-2 text-red-600">{error}</p>}
    </>
  );
}

export default function PayForm(props: {
  rentClientSecret: string;
  depositClientSecret: string;
}) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.rentClientSecret }}>
      <InnerPayForm {...props} />
    </Elements>
  );
}
