"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const STORAGE_KEY = "cookie-consent-v2";

interface CookieConsent {
  status: "accepted" | "rejected" | "custom";
  analytics: boolean;
  marketing: boolean;
}

export default function AnalyticsLoader() {
  const [allowed, setAllowed] = useState(false);

  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        setAllowed(false);
        return;
      }

      const parsed: CookieConsent = JSON.parse(saved);
      setAllowed(parsed.analytics === true);
    } catch (error) {
      console.warn(
        "Error leyendo el consentimiento para Analytics:",
        error,
      );
      setAllowed(false);
    }
  }, []);

  if (!allowed || !gaId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />

      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];

          function gtag() {
            window.dataLayer.push(arguments);
          }

          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}