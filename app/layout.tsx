import "./globals.css";
import NavbarWrapper from "./components/NavbarWrapper";
import CookieBanner from "./components/CookieBanner";
import AnalyticsLoader from "./components/AnalyticsLoader";
import Footer from "./components/Footer"; // 👈 añade el footer

export const metadata = {
  title: "MojaSzafa — wypożyczaj ubrania",
  description: "Wypożyczaj i udostępniaj ubrania między osobami w Polsce.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground font-sans">
        <NavbarWrapper />

        <main className="max-w-5xl mx-auto p-4 md:p-6">
          {children}
        </main>

        {/* Footer con enlace y botón para cookies */}
        <Footer />

        {/* Banner de cookies */}
        <CookieBanner />

        {/* Scripts de analytics solo si el usuario lo permite */}
        <AnalyticsLoader />
      </body>
    </html>
  );
}
