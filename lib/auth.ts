// lib/auth.ts — helper session untuk API route (Node runtime)
import crypto from "crypto";

export type Session = {
  id?: number | string;
  username: string;
  role: string;
  display_name?: string;
  [key: string]: unknown;
};

/** Verifikasi cookie `auth_session` yang ditandatangani HMAC-SHA256. */
export function verifySession(signedValue: string, secret: string): Session | null {
  const parts = signedValue.split(".");
  if (parts.length < 2) return null;

  const signature = parts[parts.length - 1];
  const value = parts.slice(0, -1).join(".");
  const expected = crypto.createHmac("sha256", secret).update(value).digest("hex");

  // timingSafeEqual butuh panjang sama
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    return JSON.parse(value) as Session;
  } catch {
    return null;
  }
}

/** Ambil session dari request. Return null kalau tidak login / cookie palsu. */
export function getSession(req: Request & { cookies?: { get(name: string): { value: string } | undefined } }): Session | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  // NextRequest punya req.cookies; Request biasa → parse header manual
  let raw = req.cookies?.get("auth_session")?.value;
  if (!raw) {
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(/(?:^|;\s*)auth_session=([^;]+)/);
    raw = match ? decodeURIComponent(match[1]) : undefined;
  }
  return raw ? verifySession(raw, secret) : null;
}

export const isSuperadmin = (s: Session | null) => s?.role === "superadmin";

/** Awal bulan ini dalam WIB (UTC+7), dikembalikan sebagai Date UTC. */
export function startOfMonthWIB(now = new Date()): Date {
  const wib = new Date(now.getTime() + 7 * 3600_000);
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1) - 7 * 3600_000);
}
