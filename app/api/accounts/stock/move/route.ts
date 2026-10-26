import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    // Tandai hapus + simpan target kategori (PENDING)
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
        pending_move_to: targetKategori,
        pending_move_added_by: addedBy,
      })
      .eq("id", account.id);

    if (markErr) {
      return NextResponse.json(
        { success: false, message: markErr.message },
        { status: 500 }
      );
    }

    // ═══════════════════════════════════════════════
    // LANGSUNG RETURN — Bot akan proses hapus di latar belakang
    // ═══════════════════════════════════════════════
    return NextResponse.json(
      {
        success: true,
        message: `Akun ${username} sedang diproses pindah ke ${targetKategori}.`,
        partial: true,
      },
      { status: 202 }
    );
  } catch (err: any) {
    console.error("[MOVE ERROR]", err);
    return NextResponse.json(
      { success: false, message: err.message || "Gagal" },
      { status: 500 }
    );
  }
}