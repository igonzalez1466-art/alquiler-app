"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import ChatBell from "@/app/components/ChatBell";

/* Links base (para todos) */
const navLinks = [
  { href: "/", label: "Home" },
  { href: "/listing", label: "Ogłoszenia" },
  { href: "/bookings", label: "Rezerwacje" },
];

export default function NavbarResponsive({
  isLoggedIn,
  userId,
  userRole, // ✅ nuevo
  auth,
}: {
  isLoggedIn: boolean;
  userId?: string | null;
  userRole?: string; // "USER" | "ADMIN"
  auth: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  const isAdmin = isLoggedIn && userRole === "ADMIN";

  return (
    <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
            M
          </span>
          <span className="text-base font-semibold tracking-tight">
            MojaSzafa
          </span>
        </Link>

        {/* Hamburguesa */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center justify-center rounded-md border px-2 py-1 text-sm md:hidden"
        >
          {open ? "✕" : "☰"}
        </button>

        {/* Menú escritorio */}
        <div className="hidden items-center gap-4 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm px-3 py-1.5 rounded-full transition ${
                isActive(link.href)
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {/* ✅ Link Admin SOLO si es ADMIN */}
          {isAdmin && (
            <Link
              href="/admin"
              className={`text-sm px-3 py-1.5 rounded-full transition ${
                isActive("/admin")
                  ? "bg-red-600 text-white"
                  : "text-red-600 hover:bg-red-50"
              }`}
            >
              Admin
            </Link>
          )}

          {/* Chat */}
          {isLoggedIn && userId && <ChatBell userId={userId} />}

          {/* Login / Logout */}
          <div>{auth}</div>
        </div>
      </nav>

      {/* Menú móvil */}
      {open && (
        <div className="border-t bg-white md:hidden">
          <div className="mx-auto flex max-w-5xl flex-col px-4 py-2 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm ${
                  isActive(link.href)
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* ✅ Admin también en móvil */}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm ${
                  isActive("/admin")
                    ? "bg-red-600 text-white"
                    : "text-red-600 hover:bg-red-50"
                }`}
              >
                Admin
              </Link>
            )}

            {/* Chat */}
            {isLoggedIn && userId && (
              <div className="pt-2">
                <ChatBell userId={userId} />
              </div>
            )}

            {/* Login / Logout */}
            <div className="pt-2">{auth}</div>
          </div>
        </div>
      )}
    </header>
  );
}
