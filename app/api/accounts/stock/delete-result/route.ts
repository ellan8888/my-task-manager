// app/api/accounts/stock/delete-result/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_API_KEY = process.env.BOT_API_KEY!;

export async function POST(req: NextRequest) {
  // ⭐ Auth bot
  if (req.headers.get("x-bot-api-key") !== BOT_API_KEY) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { username, success, error: errMsg } = await req.json();

  if (!username) {
    return NextResponse.json(
      { success: false, message: "username wajib" },
      { status: 400 }
    );
  }

  // ═══════════════════════════════════════════════
  // ✅ SUKSES
  // ═══════════════════════════════════════════════
  if (success) {
    const { data: acc, error: fetchErr } = await supabase
      .from("accounts_stock")
      .select("pending_move_to, pending_move_added_by")
      .eq("username", username)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json(
        { success: false, message: fetchErr.message },
        { status: 500 }
      );
    }

    // ⭐ MOVE → update row jadi kategori baru
    if (acc?.pending_move_to) {
      const targetKategori = acc.pending_move_to;
      const newAddedBy = acc.pending_move_added_by || "system";

      const { error: moveErr } = await supabase
        .from("accounts_stock")
        .update({
          deleted: false,
          deleted_at: null,
          delete_status: "done",
          delete_last_error: null,
          delete_attempts: 0,
          delete_requested_at: null,
          kategori: targetKategori,
          added_by: newAddedBy,
          used: false,
          logged_out: false,
          idle: false,
          status: "queued_for_sale",
          updated_at: new Date().toISOString(),
          pending_move_to: null,
          pending_move_added_by: null,
        })
        .eq("username", username);

      if (moveErr) {
        return NextResponse.json(
          { success: false, message: moveErr.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Akun ${username} dipindah ke ${targetKategori}`,
        moved_to: targetKategori,
      });
    }

    // ⭐ HAPUS MANUAL → hard delete
    const { error } = await supabase
      .from("accounts_stock")
      .delete()
      .eq("username", username);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Akun ${username} dihapus permanen dari DB`,
    });
  }

  // ═══════════════════════════════════════════════
  // ❌ GAGAL → increment attempts
  // ═══════════════════════════════════════════════
  const { data: row } = await supabase
    .from("accounts_stock")
    .select("delete_attempts")
    .eq("username", username)
    .maybeSingle();

  const nextAttempts = (row?.delete_attempts ?? 0) + 1;

  await supabase
    .from("accounts_stock")
    .update({
      delete_status: "failed",
      delete_attempts: nextAttempts,
      delete_last_error: errMsg ?? "Unknown error",
    })
    .eq("username", username);

  return NextResponse.json({
    success: true,
    message: `Attempt ${nextAttempts}/5 tercatat untuk ${username}`,
  });
}