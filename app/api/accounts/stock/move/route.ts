import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_API_URL = process.env.BOT_API_URL || "http://localhost:5001";

// ⏳ Polling sampai bot selesai hapus di Itemku
async function waitForDelete(
  accountId: number,
  maxMs = 45000
): Promise<"done" | "failed" | "timeout"> {
  const started = Date.now();
  const interval = 1500;

  while (Date.now() - started < maxMs) {
    const { data, error } = await supabase
      .from("accounts_stock")
      .select("delete_status")
      .eq("id", accountId)
      .maybeSingle();

    if (error || !data) return "failed";
    if (data.delete_status === "done") return "done";
    if (data.delete_status === "failed") return "failed";

    await new Promise((r) => setTimeout(r, interval));
  }
  return "timeout";
}

export async function PUT(req: NextRequest) {
  try {
    const { username, targetKategori, addedBy } = await req.json();

    if (!username || !targetKategori) {
      return NextResponse.json(
        { success: false, message: "username & targetKategori wajib" },
        { status: 400 }
      );
    }

    // 1. Cek akun asal
    const { data: account, error: fetchErr } = await supabase
      .from("accounts_stock")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (fetchErr || !account) {
      return NextResponse.json(
        { success: false, message: "Akun tidak ditemukan" },
        { status: 404 }
      );
    }

    if (account.deleted) {
      return NextResponse.json(
        { success: false, message: "Akun sudah dalam proses hapus" },
        { status: 400 }
      );
    }

    if (
      (account.kategori || "").toLowerCase() === targetKategori.toLowerCase()
    ) {
      return NextResponse.json(
        { success: false, message: "Akun sudah di kategori ini" },
        { status: 400 }
      );
    }

    // ═══════════════════════════════════════════════
    // STEP 1: Tandai hapus (sama seperti DELETE biasa)
    // ═══════════════════════════════════════════════
    const now = new Date().toISOString();
    const { error: markErr } = await supabase
      .from("accounts_stock")
      .update({
        deleted: true,
        deleted_at: now,
        delete_status: "pending",
        delete_attempts: 0,
        delete_last_error: null,
        delete_requested_at: now,
      })
      .eq("id", account.id);

    if (markErr) {
      return NextResponse.json(
        { success: false, message: markErr.message },
        { status: 500 }
      );
    }

    // ═══════════════════════════════════════════════
    // STEP 2: Tunggu bot hapus di Itemku
    // ═══════════════════════════════════════════════
    const delResult = await waitForDelete(account.id); // ⬅️ FIX: pakai account.id

    if (delResult === "failed") {
      await supabase
        .from("accounts_stock")
        .update({
          deleted: false,
          deleted_at: null,
          delete_status: null,
          delete_last_error: null,
          delete_attempts: 0,          // ⬅️ reset
          delete_requested_at: null,   // ⬅️ reset
        })
        .eq("id", account.id);

      return NextResponse.json(
        {
          success: false,
          message:
            "Bot gagal hapus di Itemku. Akun dibatalkan pindah, tetap di kategori lama.",
        },
        { status: 500 }
      );
    }

    if (delResult === "timeout") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bot belum selesai hapus di Itemku (timeout). Akun ditandai hapus, cek manual nanti.",
          partial: true,
        },
        { status: 202 }
      );
    }

    // ═══════════════════════════════════════════════
    // STEP 3: Restore row lama dengan kategori baru
    //         → bot OTOMATIS input ke Itemku
    //           (karena status = "queued_for_sale",
    //            sama seperti alur Tambah Stock manual)
    // ═══════════════════════════════════════════════
    const { data: created, error: restoreErr } = await supabase
      .from("accounts_stock")
      .update({
        deleted: false,
        deleted_at: null,
        delete_status: null,
        delete_last_error: null,
        delete_attempts: 0,
        delete_requested_at: null,
        kategori: targetKategori,
        added_by: addedBy || account.added_by || "system",
        used: false,
        logged_out: false,
        idle: false,
        status: "queued_for_sale",
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id)
      .select()
      .single();

    if (restoreErr) {
      return NextResponse.json(
        {
          success: false,
          message: `Hapus di Itemku OK, tapi restore DB gagal: ${restoreErr.message}. Cek manual.`,
          partial: true,
        },
        { status: 500 }
      );
    }

    // ═══════════════════════════════════════════════
    // STEP 4: Auto-add ke monitor (SAMA seperti POST)
    // ═══════════════════════════════════════════════
    try {
      const { data: katData } = await supabase
        .from("kategori_links")
        .select(
          "default_income, default_speed, default_pickaxe, default_egg"
        )
        .eq("kategori", targetKategori.toLowerCase().trim())
        .maybeSingle();

      if (
        katData?.default_income ||
        katData?.default_speed ||
        katData?.default_pickaxe ||
        katData?.default_egg
      ) {
        await fetch(`${BOT_API_URL}/api/monitor/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({
            username,
            target_income: katData.default_income || "0",
            target_speed: katData.default_speed || "0",
            target_pickaxe: katData.default_pickaxe || "0",
            target_egg: katData.default_egg || "0",
            input_by: addedBy || "system",
          }),
          signal: AbortSignal.timeout(5000),
        });
      }
    } catch (e: any) {
      console.warn("[MOVE] Auto-monitor gagal:", e.message);
    }

    return NextResponse.json({
      success: true,
      message: `Akun ${username} berhasil dipindah ke ${targetKategori}`,
      data: created,
    });
  } catch (err: any) {
    console.error("[MOVE ERROR]", err);
    return NextResponse.json(
      { success: false, message: err.message || "Gagal memindahkan akun" },
      { status: 500 }
    );
  }
}