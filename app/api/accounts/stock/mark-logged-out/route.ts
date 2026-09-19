import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// POST — Mark stock sebagai LOGGED OUT (setelah logout Roblox)
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Username wajib" },
        { status: 400 }
      );
    }

    // Guard: cek existing
    const { data: existing, error: fetchErr } = await supabase
      .from("accounts_stock")
      .select("username, logged_out, logged_out_at")
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

    if (existing.logged_out) {
      return NextResponse.json({
        success: true,
        message: "Udah pernah di-logout",
        skipped: true,
        logged_out_at: existing.logged_out_at,
      });
    }

    const { error } = await supabase
      .from("accounts_stock")
      .update({
        logged_out: true,
        logged_out_at: new Date().toISOString(),
        roblox_cookie: null,   // hapus cookie biar aman
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
      message: `${username} di-mark logged out`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}