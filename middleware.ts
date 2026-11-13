// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Path yang tetap publik (buyer bisa akses tanpa login)
const PUBLIC_PATHS = ["/queue"];

// Path yang selalu di-bypass (aset Next.js, favicon, API endpoints)
const BYPASS_PATHS = [
  "/manifest.webmanifest",
  "/sw.js",
  "/icon-",
  "/_next",
  "/favicon.ico",
  "/login",
  "/api/auth",
  "/api/jokian",
  "/api/queue",
  "/api/push",
  "/api/reminder",
  "/api/get-accounts",
  "/api/remove-account",
  "/api/telegram",
  "/api/income",
  "/api/accounts",
  "/api/kategori",
  "/api/bot",
  "/api/eternal",
  "/api/progress-keywords",
  "/api/cron",
  "/api/vziir0",
];

// ⭐ API yang dipakai bot / web — melewati redirect login, TAPI wajib salah satu:
//    • header x-bot-api-key = BOT_API_KEY (bot Python), atau
//    • cookie login yang sah (halaman My Task)
//    Tanpa ini, data akun (password & cookie Roblox) bisa diambil siapa saja.
const PROTECTED_API = [
  "/api/accounts",
  "/api/income",
  "/api/kategori",
  "/api/get-accounts",
  "/api/remove-account",
  "/api/progress-keywords",
  "/api/bot",
  "/api/rf",
  // Dipakai bot saja (bot selalu mengirim x-bot-api-key)
  "/api/jokian",
  // Bot (log egg, progress) + halaman admin progress-orders. Halaman pembeli tetap bisa baca
  // /api/eternal/order/[id] lewat PUBLIC_API_EXCEPTIONS.
  "/api/eternal",
  "/api/queue/update",
  "/api/queue/promote",
  "/api/queue/set-end-time",
  "/api/queue/failed",
  "/api/queue/check-completed",
  "/api/queue/update-progress",
  "/api/queue/complete-progress",
];

// Pengecualian di dalam PROTECTED_API yang memang dibuka untuk pembeli (halaman /queue/[order_id])
const PUBLIC_API_EXCEPTIONS = [/^\/api\/eternal\/order\/[^/]+$/];

// ⭐ Pakai Web Crypto API (bisa jalan di Edge Runtime)
async function verifySession(
  signedValue: string,
  secret: string
): Promise<Record<string, any> | null> {
  const parts = signedValue.split(".");
  if (parts.length < 2) return null;

  const signature = parts[parts.length - 1];
  const value = parts.slice(0, -1).join(".");

  try {
    // Import secret jadi CryptoKey
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Sign value
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(value)
    );

    // Convert ke hex
    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== expectedSig) return null;

    const parsed = JSON.parse(value);
    // Sesi kedaluwarsa (lihat lib/auth.ts — isSessionExpired; Edge tidak bisa impor modul crypto Node)
    const legacyCutoff = Date.parse("2026-11-17T17:00:00Z");
    const now = Date.now();
    if (typeof parsed.exp === "number" ? parsed.exp < now : now > legacyCutoff) return null;
    return parsed;
  } catch (err) {
    console.error("[middleware] verifySession error:", err);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. API yang dilindungi: kunci bot ATAU login
  if (
    PROTECTED_API.some((p) => pathname === p || pathname.startsWith(p + "/")) &&
    !(request.method === "GET" && PUBLIC_API_EXCEPTIONS.some((re) => re.test(pathname)))
  ) {
    const botKey = process.env.BOT_API_KEY;
    if (botKey && request.headers.get("x-bot-api-key") === botKey) {
      return NextResponse.next();
    }
    const cookie = request.cookies.get("auth_session")?.value;
    const s = cookie ? await verifySession(cookie, process.env.AUTH_SECRET!) : null;
    if (s) return NextResponse.next();
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  // 2. Bypass aset & API endpoints lain (masing-masing punya pengecekan sendiri / memang publik)
  if (BYPASS_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2. Bypass halaman publik (queue untuk buyer)
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // 3. Cek cookie session
  const signedValue = request.cookies.get("auth_session")?.value;
  if (!signedValue) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const session = await verifySession(signedValue, process.env.AUTH_SECRET!);
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Cek akses /admin/* — cuma superadmin
// 4. Cek akses /admin/users/* — cuma superadmin
//    Halaman lain di /admin/* boleh semua user (filter data di frontend)
if (
  pathname.startsWith("/admin/users") &&
  session.role !== "superadmin"
) {
  console.warn(
    `[middleware] 🚫 Blocked ${pathname} for ${session.username} (${session.role})`
  );
  return NextResponse.redirect(new URL("/admin", request.url));
}

  // 5. Inject session ke request headers
  const response = NextResponse.next();
  response.headers.set("x-user-id", String(session.id));
  response.headers.set("x-user-username", session.username);
  response.headers.set("x-user-role", session.role);
  response.headers.set("x-user-display-name", session.display_name);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};