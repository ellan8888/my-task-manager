import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// GET — List stock (support filter ?username=, ?kategori=, ?used=)
// ============================================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    const kategori = searchParams.get("kategori");
    const used = searchParams.get("used");
    const loggedOut = searchParams.get("logged_out");
    const status = searchParams.get("status");

    let query = supabase
      .from("accounts_stock")
      .select("*")
      .eq("deleted", false)
      .order("created_at", { ascending: false });

    // ★ WAJIB: filter by username (dipake bot buat cari cookie)
    if (username) query = query.eq("username", username);
    if (kategori) query = query.eq("kategori", kategori);
    if (used !== null) query = query.eq("used", used === "true");
    if (loggedOut !== null) query = query.eq("logged_out", loggedOut === "true");
    if (status) query = query.eq("status", status);

    const switched = searchParams.get("switched");
// ...
if (switched !== null) query = query.eq("switched", switched === "true");

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

// ============================================================
// POST — Input stock baru
// ============================================================
// ============================================================
// POST — Input stock baru (dengan validasi password)
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, roblox_cookie, kategori, added_by, status } = body;

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Username wajib diisi" },
        { status: 400 }
      );
    }

    // ★ Password WAJIB kalau kategori = "akun" (buat auto-login)
    const kat = (kategori || "akun").toLowerCase();
    if (kat === "akun" && !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Password wajib untuk kategori 'akun' (buat auto-login)",
        },
        { status: 400 }
      );
    }

    // Cek duplikat
    const { data: existing } = await supabase
      .from("accounts_stock")
      .select("id, username")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, message: `Username ${username} sudah ada di stock` },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("accounts_stock")
      .insert({
        username,
        password: password || null,
        roblox_cookie: roblox_cookie || null,
        kategori: kategori || "akun",
        added_by: added_by || "lan4337",
        used: false,
        logged_out: false,
        status: status || "personal",
        
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Stock ${username} berhasil ditambahkan`,
      data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE — Hapus stock (opsional)
// ============================================================
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Username wajib" },
        { status: 400 }
      );
    }

    // ★ SOFT DELETE — set deleted = true
    const { error } = await supabase
      .from("accounts_stock")
      .update({
        deleted: true,
        deleted_at: new Date().toISOString(),
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
      message: `${username} di-queue untuk dihapus (bot akan hapus di itemku)`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}