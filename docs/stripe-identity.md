# Stripe Identity — configuration

Apply migration 20261008213000_stripe_identity before deploying. No real verification was created by development or tests.

## Staging (sandbox)

Set server-only Vercel environment variables for the staging deployment:

- STRIPE_IDENTITY_ENABLED=true
- STRIPE_IDENTITY_MODE=test
- STRIPE_IDENTITY_SECRET_KEY: sk_test key from the same sandbox as Identity
- APP_URL=https://stagingmojaszafa.eu (if already configured, preserve its staging value)
- STRIPE_IDENTITY_WEBHOOK_SECRET: the signing secret for the destination below

Identity uses its own key, falling back to STRIPE_SECRET_KEY only when its mode matches. Never replace existing payment keys to enable Identity. When disabled or mismatched, starts are blocked. Secrets must never go into Git.

Create a webhook destination in the SAME Stripe sandbox, for account events, at:
https://stagingmojaszafa.eu/api/stripe/identity/webhook

Subscribe to identity.verification_session.verified, .requires_input, .processing, .canceled, .redacted. Copy that destination's signing secret to STRIPE_IDENTITY_WEBHOOK_SECRET, then redeploy. This is separate from the payment webhook and its signing secret.

Sessions are created by the authenticated app, with document, matching selfie and live camera capture. A manual dashboard session or public static link does not update any user. No flow ID is required.

## Check end to end

1. Sign in and open /account. Start identity verification.
2. On Stripe's test screen select success and submit; return to /account.
3. Check verified (test), webhook HTTP 200, and refreshing the account. Public profiles must NOT show a real verified badge for test sessions.
4. Test failure/resubmission, processing, canceled and redacted. An old or repeated webhook cannot approve a different user/session.
5. Check a different account; it must remain unverified. Clicking rapidly must reuse the same session.

## Production

Activate Identity with genuine business details. Confirm privacy/legal basis, retention/deletion, access privileges and non-biometric alternative before enabling real checks. Update privacy policy with the operator's actual contact and retention policy; hosting files at Stripe is still personal-data processing on our behalf. Create a live webhook, use live Identity key, live signing secret, STRIPE_IDENTITY_MODE=live and the production APP_URL. Test results never grant real verified badges. Live-verified users are not overwritten by sandbox starts.

This feature does not make verification mandatory for booking/publication. Connect payout onboarding remains separate. Only live verification grants the public badge. Session IDs, states, timestamps, mode and attempt counter are stored; no extracted names/PESEL/images/client_secret/session URL are stored or logged. Authorized administration may access retained data in the Stripe Dashboard; there is no new in-app document viewer.
