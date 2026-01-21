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

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const parsed: CookieConsent = JSON.parse(saved);
      if (parsed.analytics) {
        setAllowed(true);
      }
    } catch (e) {
      console.warn("Error leyendo consent para analytics", e);
    }
  }, []);

  if (!allowed) return null;

  const GA_ID = "G-XXXXXXX"; // 🔴 pon aquí tu ID real

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-consent" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
