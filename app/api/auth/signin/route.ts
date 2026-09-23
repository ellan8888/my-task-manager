// app/api/auth/signin/route.ts
import { NextRequest, NextResponse } from "next/server";
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

    // 1. Cari user di DB
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, username, password_hash, display_name, role, is_active")
      .eq("username", username.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error("[signin] Supabase error:", error);
      return NextResponse.json(
        { success: false, message: "Gagal cek user: " + error.message },
        { status: 500 }
      );
    }

    if (!user) {
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
      maxAge: 60 * 60 * 24 * 7,
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