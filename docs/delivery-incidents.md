# Delivery incidents and rental settlement

- Before dispatch / personal handover is recorded: NOT_SHIPPED.
- After shippedAt or SHIPPED / DELIVERED is recorded: NOT_RECEIVED. These are owner declarations, not renter receipt confirmation.
- Damage and description mismatch still require a photo. LATE_DELIVERY requires a real past receipt date after the first rental day.
- Missing item: no partial-refund proposal, acceptance or owner transfer. This also applies when retrying a previously frozen settlement.
- Owner may record waiting for delivery with a comment. The case stays open and no financial agreement is created.
- Renter may request full cancellation without waiting for an owner proposal. Owner must accept; the refund is exactly 100% and no owner transfer occurs.
- Either participant may request review while delivery is missing. Review does not release money or automatically adjudicate the case.
- Renter alone records subsequent arrival. The date is validated, previous proposals are cleared, and the case returns to the owner. Receipt registration does not confirm rental acceptance or release payment.
- If arrival was after the first rental day, the case becomes LATE_DELIVERY with the existing proportional suggestion. Arrival on/before the first day does not invent a delay discount.
- Partial / zero refund following arrival still requires a new proposal and the renter's explicit receipt / rental acceptance.
- Financial agreement, refund confirmation and transfer remain separate steps. A failed Stripe operation can retry the same frozen decision.

No schema migration or environment changes required. The existing NOT_RECEIVED enum and reportedDeliveryDate field are reused. Old paid / accepted settlements are not rewritten.

Validation: tests/rent-incidents.cjs covers server authorization, dispatch selection, missing-item payout gates, wait / cancellation / arrival / review, date validation, proportional amounts and existing settlement retries. Tests use mocked Stripe and database operations.
