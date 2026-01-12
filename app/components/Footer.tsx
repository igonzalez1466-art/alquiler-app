"use client";

import Link from "next/link";

export default function Footer() {
  const openSettings = () => {
    window.dispatchEvent(new Event("open-cookie-settings"));
  };

  return (
    <footer className="mt-10 border-t py-6 text-center text-sm text-gray-600">
      <div className="flex flex-col items-center gap-4 md:flex-row md:justify-center md:gap-8">

        {/* O nas */}
        <Link href="/o-nas" className="underline hover:text-gray-800">
          O nas
        </Link>

        {/* Kontakt */}
        <Link href="/contact" className="underline hover:text-gray-800">
          Kontakt
        </Link>

        {/* Regulamin */}
        <Link href="/regulamin" className="underline hover:text-gray-800">
          Regulamin
        </Link>

        {/* Polityka Cookies */}
        <Link
          href="/polityka-cookies"
          className="underline hover:text-gray-800"
        >
          Polityka plików cookie
        </Link>

        {/* Zmień ustawienia */}
        <button
          onClick={openSettings}
          className="underline hover:text-gray-800"
        >
          Zmień ustawienia plików cookie
        </button>

        {/* Polityka Prywatności – última */}
        <Link
          href="/polityka-prywatnosci"
          className="underline hover:text-gray-800"
        >
          Polityka prywatności
        </Link>

      </div>
    </footer>
  );
}
