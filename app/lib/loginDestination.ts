/** Accept only local destinations; email links must never redirect to another site. */
export function loginDestination(value: string | null, origin?: string): string {
  if (!value || /[\\\u0000-\u0020]/.test(value)) return "/";
  try {
    const base = origin || "https://local.invalid";
    const url = new URL(value, base);
    if (url.origin !== new URL(base).origin || value.startsWith("//")) return "/";
    if (!value.startsWith("/") && !origin) return "/";
    if (url.pathname === "/login" || url.pathname.startsWith("/api/auth") || url.pathname.startsWith("/auth/error")) return "/";
    return url.pathname + url.search + url.hash;
  } catch { return "/"; }
}
