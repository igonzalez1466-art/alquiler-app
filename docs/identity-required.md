# Required identity verification

Apply migration 20261009001000_listing_drafts before deploying. Existing listings retain their current status; new reservations and payment initiation require verified owner and renter. Existing paid bookings, chats, incidents, returns and payouts are not blocked by this new check.

Publication, reactivation, both booking actions, listing creation API and payment-intent creation enforce the requirement on the server using the database, not browser state. Users can save a complete listing with its photos as a private draft; drafts appear only under their own listings and owner detail, are excluded from search/map/metadata and cannot be reserved or contacted.

Only live verified identity with a verification timestamp is accepted on the real website. A simulated verified result is accepted for testing only when STRIPE_IDENTITY_MODE=test and APP_URL has HTTPS and the exact hostname stagingmojaszafa.eu. No public real identity badge is granted by test verification. Missing/processing/canceled/redacted verification is rejected. Disabled Identity does not bypass requirements.

Verification links keep an allowlisted local return route. Users save the draft first, verify from the draft page, return and publish it. Both publication paths and API callers are blocked without verification; deactivation is still allowed.

Before real launch, configure live Identity and its webhook so users can complete real checks. Test staging with two accounts: renter and owner. Verify unavailable states, draft privacy, direct action/API attempts, live/test separation and successful publication/reservation/payment.
