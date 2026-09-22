"use client";
import { settlementWithFeedback } from "../_actions/settlementWithFeedback";
async function run(data: FormData, operation: Parameters<typeof settlementWithFeedback>[1]) {
  const result = await settlementWithFeedback(data, operation);
  if (!result.ok) {
    const error = new Error(result.message);
    error.name = result.payoutSetup ? "PayoutSetupRequired" : "SettlementFailed";
    throw error;
  }
}
export const releaseDepositAction = (data: FormData) => run(data, "full");
export const partialReleaseDepositAction = (data: FormData) => run(data, "partial");
export const retainDepositAction = (data: FormData) => run(data, "retain");
export const retrySettlementAction = (data: FormData) => run(data, "retry");
export const executeApprovedClaimAction = (data: FormData) => run(data, "approved");
