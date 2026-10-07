"use client";
import { userMessage } from "@/app/lib/userMessage";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { settleRentOnlyAction } from "../_actions/settleRentOnlyAction";
import PayoutSetupNotice from "./PayoutSetupNotice";

export default function RentOnlySettlementButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div className="space-y-2">
    <button type="button" disabled={pending} aria-busy={pending}
      className="inline-flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      onClick={async () => {
        setPending(true); setError("");
        try { await settleRentOnlyAction(bookingId); router.refresh(); }
        catch (failure) { setError(userMessage(failure, "Nie udało się rozliczyć najmu.")); }
        finally { setPending(false); }
      }}>
      {pending && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {pending ? "Rozliczanie…" : "Rozlicz najem"}
    </button>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {error.toLowerCase().includes("konto wypłat") && <PayoutSetupNotice isOwner />}
  </div>;
}
