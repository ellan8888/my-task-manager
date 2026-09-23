// app/api/accounts/stock/by-username/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ⚠️ ENDPOINT INI KHUSUS BUAT BOT PYTHON
// Nggak wajib session — bot butuh akses global buat auto-logout
// Middleware harus exclude path ini
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { success: false, message: "username wajib" },
        { status: 400 }
      );
    }

    // ⭐ Query TANPA filter added_by/status/deleted + case-insensitive
    const { data, error } = await supabaseAdmin
      .from("accounts_stock")
      .select("*")
      .ilike("username", username)         // case-insensitive
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, message: "Akun nggak ketemu" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}