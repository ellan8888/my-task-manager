// app/api/accounts/stock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ⭐ Helper verify signed cookie
function verifySession(
  signedValue: string,
  secret: string
): Record<string, any> | null {
  const parts = signedValue.split(".");
  if (parts.length < 2) return null;
  const signature = parts[parts.length - 1];
  const value = parts.slice(0, -1).join(".");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(value);
  if (signature !== hmac.digest("hex")) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// ============================================================
// GET — List stock (support filter ?username=, ?kategori=, ?used=)
// ============================================================
export async function GET(req: NextRequest) {
  try {
    // ⭐ 1. Ambil session user
    const signedValue = req.cookies.get("auth_session")?.value;
    const session = signedValue
      ? verifySession(signedValue, process.env.AUTH_SECRET!)
      : null;

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    const kategori = searchParams.get("kategori");
    const used = searchParams.get("used");
    const loggedOut = searchParams.get("logged_out");
    const status = searchParams.get("status");
    const switched = searchParams.get("switched");

    // ⭐ 2. Build query
    let query = supabase
      .from("accounts_stock")
      .select("*")
      .eq("deleted", false);

    // ⭐ 3. FILTER UTAMA: cuma data added_by = user yang login
    //    (termasuk superadmin — lu mau admin juga cuma liat punya sendiri)
    query = query.eq("added_by", session.username);

    // ⭐ 4. Filter tambahan
    if (username) query = query.eq("username", username);
    if (kategori) query = query.eq("kategori", kategori);
    if (used !== null) query = query.eq("used", used === "true");
    if (loggedOut !== null) query = query.eq("logged_out", loggedOut === "true");
    if (status) query = query.eq("status", status);
    if (switched !== null) query = query.eq("switched", switched === "true");

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}

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
// PATCH — Edit akun
// ============================================================
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, roblox_cookie, kategori, added_by } = body;
    const { searchParams } = new URL(req.url);
    const targetUsername = searchParams.get("username");

    if (!targetUsername) {
      return NextResponse.json(
        { success: false, message: "Username target wajib" },
        { status: 400 }
      );
    }

    // Cek existing
    const { data: existing, error: fetchErr } = await supabase
      .from("accounts_stock")
      .select("username, status, used, logged_out")
      .eq("username", targetUsername)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json(
        { success: false, message: fetchErr.message },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Akun nggak ada di stock" },
        { status: 404 }
      );
    }

    // Guard: jangan edit kalau udah laku
    if (existing.logged_out) {
      return NextResponse.json(
        { success: false, message: "Akun udah laku — nggak bisa diedit" },
        { status: 400 }
      );
    }

    // Kalau username baru beda, cek dulu apakah udah ada
    if (username && username !== targetUsername) {
      const { data: dupe } = await supabase
        .from("accounts_stock")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (dupe) {
        return NextResponse.json(
          { success: false, message: `Username "${username}" udah ada` },
          { status: 409 }
        );
      }
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    if (username !== undefined) updateData.username = username;
    if (password !== undefined) updateData.password = password || null;
    if (roblox_cookie !== undefined) updateData.roblox_cookie = roblox_cookie || null;
    if (kategori !== undefined) updateData.kategori = kategori;
    if (added_by !== undefined) updateData.added_by = added_by;

    const { data, error } = await supabase
      .from("accounts_stock")
      .update(updateData)
      .eq("username", targetUsername)
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
      message: `Akun "${targetUsername}" berhasil diupdate`,
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
// DELETE — Soft delete stock
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