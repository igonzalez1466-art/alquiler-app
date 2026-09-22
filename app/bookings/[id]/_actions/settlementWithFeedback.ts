"use server";
import { releaseDepositAction, partialReleaseDepositAction, retainDepositAction, retrySettlementAction } from "./depositActions";
import { executeApprovedClaimAction } from "./depositClaimActions";

export async function settlementWithFeedback(data: FormData, operation: "full" | "partial" | "retain" | "retry" | "approved") {
  try {
    switch (operation) {
      case "full": await releaseDepositAction(data); break;
      case "partial": await partialReleaseDepositAction(data); break;
      case "retain": await retainDepositAction(data); break;
      case "retry": await retrySettlementAction(data); break;
      case "approved": await executeApprovedClaimAction(data); break;
      default: throw new Error("Invalid settlement operation");
    }
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/\.$/, "") : "";
    if (["Właściciel nie ma skonfigurowanego konta wypłat", "Konto wypłat właściciela nie jest aktywne"].includes(message)) {
      return { ok: false as const, payoutSetup: true, message: "Nie można dokończyć rozliczenia, ponieważ konto wypłat właściciela nie jest skonfigurowane lub aktywne." };
    }
    console.error("[SETTLEMENT] Action failed", error);
    return { ok: false as const, payoutSetup: false, message: "Nie udało się dokończyć rozliczenia. Odśwież rezerwację i sprawdź status płatności. Jeśli problem się powtarza, skontaktuj się z obsługą serwisu." };
  }
}
