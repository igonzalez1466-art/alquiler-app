"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ChatBell from "@/app/components/ChatBell";

export default function Navbar({
  auth,
  isLoggedIn,
  userId,
  userRole, // ✅ nuevo
}: {
  auth: React.ReactNode;
  isLoggedIn: boolean;
  userId?: string;
  userRole?: string; // o: "USER" | "ADMIN"
}) {
  const pathname = usePathname();
  const isAdmin = isLoggedIn && userRole === "ADMIN";

  const links = [
    { href: "/", label: "Home" },
    { href: "/listing", label: "Listings" },

    ...(isLoggedIn ? [{ href: "/listing/new", label: "List item" }] : []),
    ...(isLoggedIn ? [{ href: "/bookings", label: "Bookings" }] : []),

    // ✅ SOLO ADMIN
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="px-8 py-4 bg-white shadow flex items-center sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-2">
        <Image
          src="/logo.png"
          alt="Mi Web"
          width={40}
          height={40}
          className="rounded"
          style={{ width: 40, height: 40 }}
          priority
        />
        <span className="font-bold text-xl text-gray-800">MojaSzafa</span>
      </Link>

      <div className="ml-auto flex gap-6 text-gray-700 font-medium items-center">
        {links.map((l) => {
          const active =
            pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`transition-colors ${
                active
                  ? "text-blue-600 font-semibold border-b-2 border-blue-600"
                  : "hover:text-blue-600"
              }`}
            >
              {l.label}
            </Link>
          );
        })}

        {isLoggedIn && userId && <ChatBell userId={userId} />}

        {auth}
      </div>
    </nav>
  );
}
