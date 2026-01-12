"use client";

import { useEffect, useState } from "react";

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

  // aquí pondrías tu código de GA o el de la lib que uses
  return (
    <>
      {/* Ejemplo con gtag "manual" (rellena tu ID) */}
      <script
        async
        src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XXXXXXX');
          `,
        }}
      />
    </>
  );
}
