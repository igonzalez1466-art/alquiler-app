"use client";

import { useState } from "react";
import {
  releaseDepositAction,
  partialReleaseDepositAction,
  retainDepositAction,
} from "../_actions/depositActions";

export default function DepositActions({ bookingId, depositZl }: any) {
  const [mode, setMode] = useState("refund");
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(depositZl - 1);
  const [reason, setReason] = useState("");

  const retained = depositZl - amount;

  return (
    <div className="space-y-4">

      <div className="space-y-2">
        <label><input type="radio" checked={mode==="refund"} onChange={()=>setMode("refund")} /> Całość</label>
        <label><input type="radio" checked={mode==="partial"} onChange={()=>setMode("partial")} /> Część</label>
        <label><input type="radio" checked={mode==="retain"} onChange={()=>setMode("retain")} /> Zatrzymaj</label>
      </div>

      {mode==="refund" && (
        <form action={releaseDepositAction}>
          <input type="hidden" name="bookingId" value={bookingId}/>
          <button disabled={loading}>Zwróć całość</button>
        </form>
      )}

      {mode==="partial" && (
        <form action={partialReleaseDepositAction}>
          <input type="hidden" name="bookingId" value={bookingId}/>
          <input name="refundAmountZl" value={amount} onChange={e=>setAmount(Number(e.target.value))}/>
          <textarea name="reason" value={reason} onChange={e=>setReason(e.target.value)}/>
          <div>Zwrot: {amount} zł</div>
          <div>Zatrzymane: {retained} zł</div>
          <button>Zwróć część</button>
        </form>
      )}

      {mode==="retain" && (
        <form action={retainDepositAction}>
          <input type="hidden" name="bookingId" value={bookingId}/>
          <textarea name="reason" value={reason} onChange={e=>setReason(e.target.value)}/>
          <button>Zatrzymaj</button>
        </form>
      )}
    </div>
  );
}