This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# Phone verification

Phone verification uses Twilio Verify. Configure these variables in every environment that accepts bookings:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`

# Google authentication

Create an OAuth 2.0 client of type **Web application** in Google Cloud and configure:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Authorized redirect URIs must match the deployment exactly:

- Local: `http://localhost:3000/api/auth/callback/google`
- Staging: `https://YOUR-STAGING-DOMAIN/api/auth/callback/google`
- Production: `https://YOUR-PRODUCTION-DOMAIN/api/auth/callback/google`

# InPost point picker

The **Mój punkt InPost** section can show InPost's official Geowidget so users can choose a pickup point on a map. Request a Geowidget key for each website domain from InPost, then set `INPOST_GEOWIDGET_TOKEN` in the corresponding environment (for example, the staging key for `stagingmojaszafa.eu` and a separate production key for the production domain). The key is supplied to the browser only when the account page is rendered; it is domain-bound, not a server API secret.

The map loads only after the user opens it. Selecting a point fills in its code and address; the user then saves the profile form. If no key is configured or the widget cannot load, the existing manual fields remain available. See [InPost's Geowidget integration guide](https://developers.inpost-group.com/geowidget-integration).
