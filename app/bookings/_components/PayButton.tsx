"use client";

import { useState } from "react";

export function PayButton() {
  const [msg, setMsg] = useState<string | null>(null);

  const onClick = () => {
    setMsg(
      "Los pagos online están desactivados por el momento. Contacta con el propietario para acordar el pago."
    );
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onClick}
        className="px-4 py-2 rounded-md bg-gray-300 text-gray-700 cursor-not-allowed"
      >
        Pagar (desactivado)
      </button>

      {msg && <p className="text-xs text-gray-500">{msg}</p>}
    </div>
  );
}
