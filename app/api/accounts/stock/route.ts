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
// GET — List stock
// ⭐ Support 2 mode auth:
//    1. User (cookie auth_session)
//    2. Bot (header x-bot-api-key)
// ============================================================
export async function GET(req: NextRequest) {
  try {
    // ⭐ 1. Cek dulu apakah request dari BOT
    const botApiKey = req.headers.get("x-bot-api-key");
    const isBot = botApiKey === process.env.BOT_API_KEY;

    // ⭐ 2. Kalau bukan bot, cek session cookie
    let session: Record<string, any> | null = null;
    if (!isBot) {
      const signedValue = req.cookies.get("auth_session")?.value;
      session = signedValue
        ? verifySession(signedValue, process.env.AUTH_SECRET!)
        : null;

      if (!session) {
        return NextResponse.json(
          { success: false, message: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    const kategori = searchParams.get("kategori");
    const used = searchParams.get("used");
    const loggedOut = searchParams.get("logged_out");
    const status = searchParams.get("status");
    const switched = searchParams.get("switched");

    // ⭐ 3. Build query
    let query = supabase
      .from("accounts_stock")
      .select("*")
      .eq("deleted", false);

    // ⭐ 4. FILTER added_by — HANYA kalau user (bukan bot)
    if (!isBot && session) {
      query = query.eq("added_by", session.username);
    }

    // ⭐ 5. Filter tambahan
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

    // ═══════════════════════════════════════════════════════
    // ⭐ 6. KALAU logged_out=true → JOIN income_log
    //    (buat halaman Akun Laku, biar nampilin income per akun)
    // ═══════════════════════════════════════════════════════
    if (loggedOut === "true" && data && data.length > 0) {
      try {
        // Ambil semua username dari data
        const usernames = data.map((a) => a.username);

        // Fetch income_log untuk semua username sekaligus
        const { data: incomes, error: incomeErr } = await supabase
          .from("income_log")
          .select("order_id, roblox_username, amount, joki_name, completed_at")
          .in("roblox_username", usernames);

        if (incomeErr) {
          console.error("[stock GET] income_log error:", incomeErr.message);
          // Kalau join gagal, tetap return data tanpa income
          return NextResponse.json({ success: true, data });
        }

        // Build map: { "Yuro76511": [{ amount, order_id, ... }] }
        const incomeMap: Record<string, any[]> = {};
        (incomes || []).forEach((inc) => {
          if (!inc.roblox_username) return;
          if (!incomeMap[inc.roblox_username]) {
            incomeMap[inc.roblox_username] = [];
          }
          incomeMap[inc.roblox_username].push(inc);
        });

        // Inject income ke tiap akun
        const dataWithIncome = data.map((acc) => {
          const accIncomes = incomeMap[acc.username] || [];
          const totalIncome = accIncomes.reduce(
            (sum, inc) => sum + (inc.amount || 0),
            0
          );

          return {
            ...acc,
            income_amount: totalIncome || null,
            income_details: accIncomes,
          };
        });

        return NextResponse.json({ success: true, data: dataWithIncome });
      } catch (joinErr: any) {
        console.error("[stock GET] Gagal join income_log:", joinErr);
        // Fallback: return data tanpa income
        return NextResponse.json({ success: true, data });
      }
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
// POST — Input stock baru (dengan validasi password + RESTORE)
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

    // ══════════════════════════════════════════════════════════
    // ⭐ CEK DUPLIKAT — ambil info deleted
    // ══════════════════════════════════════════════════════════
    const { data: existing } = await supabase
      .from("accounts_stock")
      .select("id, username, deleted, logged_out")
      .eq("username", username)
      .maybeSingle();

    // ══════════════════════════════════════════════════════════
    // ⭐ CASE 1: Row ada & DELETED → RESTORE (bukan insert baru)
    // ══════════════════════════════════════════════════════════
    if (existing && existing.deleted) {
      console.log(`[Stock POST] Restore akun "${username}" (id=${existing.id})`);

      const { data: restored, error: restoreError } = await supabase
        .from("accounts_stock")
        .update({
          deleted: false,
          deleted_at: null,
          password: password || null,
          roblox_cookie: roblox_cookie || null,
          kategori: kategori || "akun",
          added_by: added_by || "lan4337",
          used: false,
          logged_out: false,
          idle: false,
          idle_marked_at: null,
          status: status || "personal",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (restoreError) {
        console.error("[Stock POST] Restore error:", restoreError);
        return NextResponse.json(
          { success: false, message: restoreError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Stock ${username} berhasil di-restore`,
        action: "restored",     // ⭐ info ke frontend
        data: restored,
      });
    }

    // ══════════════════════════════════════════════════════════
    // ⭐ CASE 2: Row ada & AKTIF → REJECT DUPLIKAT
    // ══════════════════════════════════════════════════════════
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: `Username ${username} sudah ada di stock`,
          code: "DUPLICATE_ACTIVE",   // ⭐ info ke frontend
        },
        { status: 409 }
      );
    }

    // ══════════════════════════════════════════════════════════
    // ⭐ CASE 3: Row nggak ada → INSERT BARU
    // ══════════════════════════════════════════════════════════
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
        idle: false,
        status: status || "personal",
      })
      .select()
      .single();

    if (error) {
      console.error("[Stock POST] Insert error:", error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Stock ${username} berhasil ditambahkan`,
      action: "created",     // ⭐ info ke frontend
      data,
    });
  } catch (err: any) {
    console.error("[Stock POST] Exception:", err);
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