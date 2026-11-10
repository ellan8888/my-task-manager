// app/api/auth/signin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { SESSION_MAX_AGE_SEC } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function signSession(value: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(value);
  return `${value}.${hmac.digest("hex")}`;
}

const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60 * 1000;

async function tooManyFailures(username: string, ip: string | null): Promise<boolean> {
  try {
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const byUser = supabaseAdmin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("username", username)
      .gte("created_at", since);
    const byIp = ip
      ? supabaseAdmin.from("login_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", since)
      : null;
    const [u, i] = await Promise.all([byUser, byIp]);
    return (u.count ?? 0) >= MAX_FAILURES || (i?.count ?? 0) >= MAX_FAILURES * 2;
  } catch {
    return false; // tabel belum ada / error → jangan blokir login
  }
}

async function recordFailure(username: string, ip: string | null) {
  try {
    await supabaseAdmin.from("login_attempts").insert({ username, ip });
  } catch {}
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Username & password wajib diisi" },
        { status: 400 }
      );
    }

    const uname = String(username).toLowerCase().trim();
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;

    // 0. Batasi tebak password: maks 8 gagal / 15 menit per username atau per IP
    if (await tooManyFailures(uname, ip)) {
      return NextResponse.json(
        { success: false, message: "Terlalu banyak percobaan gagal. Coba lagi 15 menit lagi." },
        { status: 429 }
      );
    }

    // 1. Cari user di DB
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, username, password_hash, display_name, role, is_active")
      .eq("username", uname)
      .maybeSingle();

    if (error) {
      console.error("[signin] Supabase error:", error);
      return NextResponse.json(
        { success: false, message: "Gagal cek user: " + error.message },
        { status: 500 }
      );
    }

    if (!user) {
      await recordFailure(uname, ip);
      return NextResponse.json(
        { success: false, message: "Username / password salah" },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { success: false, message: "Akun kamu dinonaktifkan. Hubungi admin." },
        { status: 403 }
      );
    }

    // 2. Verify password pakai bcrypt
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      await recordFailure(uname, ip);
      return NextResponse.json(
        { success: false, message: "Username / password salah" },
        { status: 401 }
      );
    }

    // 3. Update last_login_at
    await supabaseAdmin
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id);

    // 4. Buat session payload
    const sessionPayload = JSON.stringify({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      exp: Date.now() + SESSION_MAX_AGE_SEC * 1000, // sesi berakhir, walau cookie disalin
    });

    // 5. Sign
    const signedSession = signSession(sessionPayload, process.env.AUTH_SECRET!);

    // 6. Set cookie
    const response = NextResponse.json({
      success: true,
      message: "Login berhasil",
      user: {
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      },
    });

    response.cookies.set("auth_session", signedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SEC,
    });

    console.log(`[signin] ✅ Login sukses: ${user.username} (${user.role})`);

    return response;
  } catch (err: any) {
    console.error("[signin] Error:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Terjadi kesalahan" },
      { status: 500 }
    );
  }
}