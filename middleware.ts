// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Path yang tetap publik (buyer bisa akses tanpa login)
const PUBLIC_PATHS = ["/queue"];

// Path yang selalu di-bypass (aset Next.js, favicon, dll)
const BYPASS_PATHS = ["/_next", "/favicon.ico", "/login", "/api/auth"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bypass aset & halaman login
  if (BYPASS_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2. Bypass halaman publik (queue untuk buyer)
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // 3. Cek cookie session
  const session = request.cookies.get("auth_session")?.value;

  if (session === process.env.AUTH_SECRET) {
    return NextResponse.next();
  }

  // 4. Belum login → redirect ke /login dengan callback URL
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};