import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { username, roblox_cookie } = await req.json();

    if (!username || !roblox_cookie) {
      return NextResponse.json(
        { success: false, message: "username & roblox_cookie wajib" },
        { status: 400 }
      );
    }

    // Cek existing
    const { data: existing, error: fetchErr } = await supabase
      .from("accounts_stock")
      .select("username, logged_out")
      .eq("username", username)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json(
        { success: false, message: fetchErr.message },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Username nggak ada di stock" },
        { status: 404 }
      );
    }

    // ★ Kalau udah logged_out, jangan update cookie
    if (existing.logged_out) {
      return NextResponse.json({
        success: false,
        message: "Akun udah logged out — nggak bisa update cookie",
        skipped: true,
      });
    }

    const { error } = await supabase
      .from("accounts_stock")
      .update({
        roblox_cookie,
        updated_at: new Date().toISOString(),
      })
      .eq("username", username);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Cookie ${username} diupdate`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}