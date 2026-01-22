import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (process.env.MAINTENANCE_MODE === "true") {
    // Permite que la propia página de maintenance cargue
    if (req.nextUrl.pathname.startsWith("/maintenance")) {
      return NextResponse.next();
    }
    // (Opcional) deja pasar assets de Next
    if (req.nextUrl.pathname.startsWith("/_next")) {
      return NextResponse.next();
    }

    const url = req.nextUrl.clone();
    url.pathname = "/maintenance";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

// Aplica a todo excepto estáticos típicos
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
