// app/api/accounts/stock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// === POST: Input stock baru ===
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, roblox_cookie, kategori, added_by } = body;

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Username wajib diisi" },
        { status: 400 }
      );
    }

    // Cek duplikat
    const { data: existing } = await supabase
      .from("accounts_stock")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, message: "Username sudah ada di stock" },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("accounts_stock")
      .insert({
        username,
        password,
        roblox_cookie,
        kategori,
        added_by,
        used: false,
        logged_out: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
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

// === GET: List stock ===
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const kategori = searchParams.get("kategori");
    const used = searchParams.get("used");
    const username = searchParams.get("username");   // ★ TAMBAH INI

    let query = supabase
      .from("accounts_stock")
      .select("*")
      .order("created_at", { ascending: false });

    if (kategori) query = query.eq("kategori", kategori);
    if (used !== null) query = query.eq("used", used === "true");
    if (username) query = query.eq("username", username);   // ★ TAMBAH INI

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
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