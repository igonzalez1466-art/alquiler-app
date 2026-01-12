"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "cookie-consent-v2";

type ConsentStatus = "accepted" | "rejected" | "custom";

interface CookieConsent {
  status: ConsentStatus;
  analytics: boolean;
  marketing: boolean;
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  const pathname = usePathname();

  // decidir si mostramos el banner según la ruta + localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 👉 Nunca mostramos el banner en la página de política de cookies
    if (pathname === "/polityka-cookies") {
      setVisible(false);
      return;
    }

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        // usuario nuevo → mostrar banner
        setVisible(true);
        return;
      }

      const parsed: CookieConsent = JSON.parse(saved);

      if (!parsed.status) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    } catch (e) {
      console.warn("Error leyendo cookie consent", e);
      setVisible(true);
    }
  }, [pathname]);

  // permitir que el footer abra de nuevo la configuración
  useEffect(() => {
    const handler = () => {
      // solo lo mostramos si NO estamos en /polityka-cookies
      if (pathname !== "/polityka-cookies") {
        setShowSettings(true);
        setVisible(true);
      }
    };

    window.addEventListener("open-cookie-settings", handler);
    return () => window.removeEventListener("open-cookie-settings", handler);
  }, [pathname]);

  const saveConsent = (data: CookieConsent) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  };

  const handleAcceptAll = () => {
    saveConsent({ status: "accepted", analytics: true, marketing: true });
    setVisible(false);
  };

  const handleRejectAll = () => {
    saveConsent({ status: "rejected", analytics: false, marketing: false });
    setVisible(false);
  };

  const handleSaveSettings = () => {
    saveConsent({ status: "custom", analytics, marketing });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="mx-4 max-w-3xl rounded-md bg-white p-6 md:p-8 shadow-lg">
        {!showSettings ? (
          <>
            <p className="mb-4 text-sm leading-relaxed text-gray-800 md:text-base">
              Korzystamy z plików cookie własnych oraz stron trzecich, aby
              zrozumieć działanie naszej strony i móc ją udoskonalać,
              dostosowywać treści do indywidualnych zainteresowań odbiorców
              oraz personalizować nasze reklamy i treści marketingowe. Możesz
              wyrazić zgodę na wszystkie pliki cookie, odrzucić je lub
              samodzielnie wybrać konfigurację, klikając odpowiednie przyciski.
            </p>
            <p className="mb-6 text-sm text-gray-800">
              Więcej informacji znajdziesz w naszej{" "}
              <a href="/polityka-cookies" className="font-semibold underline">
                Polityce plików cookie
              </a>
              .
            </p>

            <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between">
              <button
                className="text-sm font-semibold underline"
                onClick={() => setShowSettings(true)}
              >
                Ustawienia plików cookie
              </button>

              <div className="flex flex-col gap-3 md:flex-row">
                <button
                  className="w-full rounded-md border border-black px-6 py-2 text-sm font-semibold hover:bg-gray-100"
                  onClick={handleRejectAll}
                >
                  Odrzucenie wszystkich
                </button>
                <button
                  className="w-full rounded-md bg-black px-6 py-2 text-sm font-semibold text-white hover:bg-gray-900"
                  onClick={handleAcceptAll}
                >
                  Akceptuj wszystkie pliki cookie
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-lg font-semibold">
              Ustawienia plików cookie
            </h2>
            <p className="mb-4 text-sm text-gray-700">
              Tutaj możesz dostosować swoje preferencje dotyczące plików cookie.
              Niezbędne pliki cookie są zawsze włączone, ponieważ są wymagane do
              prawidłowego funkcjonowania strony.
            </p>

            <div className="mb-4 space-y-3">
              <div className="flex items-start gap-3">
                <input type="checkbox" checked disabled className="mt-1" />
                <div>
                  <div className="text-sm font-semibold">
                    Niezbędne pliki cookie
                  </div>
                  <p className="text-xs text-gray-600">
                    Wymagane do podstawowego działania strony (logowanie,
                    bezpieczeństwo itd.).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-semibold">
                    Analityczne pliki cookie
                  </div>
                  <p className="text-xs text-gray-600">
                    Pomagają zrozumieć, w jaki sposób użytkownicy korzystają z
                    naszej strony.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-semibold">
                    Marketingowe pliki cookie
                  </div>
                  <p className="text-xs text-gray-600">
                    Używane do personalizacji reklam i treści marketingowych.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:justify-end">
              <button
                className="text-sm underline"
                onClick={() => setShowSettings(false)}
              >
                Wróć
              </button>
              <button
                className="rounded-md bg-black px-6 py-2 text-sm font-semibold text-white hover:bg-gray-900"
                onClick={handleSaveSettings}
              >
                Zapisz ustawienia
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
