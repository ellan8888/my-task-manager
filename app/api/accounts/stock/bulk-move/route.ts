import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { fromKategori, targetKategori, addedBy } = await req.json();

    if (!fromKategori || !targetKategori) {
      return NextResponse.json(
        { success: false, message: "Kategori asal & tujuan wajib diisi" },
        { status: 400 }
      );
    }

    if (fromKategori.toLowerCase() === targetKategori.toLowerCase()) {
      return NextResponse.json(
        { success: false, message: "Kategori asal dan tujuan tidak boleh sama" },
        { status: 400 }
      );
    }

    // 1. Ambil semua akun di kategori asal yang aktif (belum dihapus)
    const { data: accounts, error: fetchErr } = await supabase
      .from("accounts_stock")
      .select("id")
      .eq("kategori", fromKategori)
      .eq("deleted", false);

    if (fetchErr) {
      return NextResponse.json({ success: false, message: fetchErr.message }, { status: 500 });
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json(
        { success: false, message: `Tidak ada akun aktif di kategori "${fromKategori}"` },
        { status: 404 }
      );
    }

    const accountIds = accounts.map((a) => a.id);
    const now = new Date().toISOString();

    // 2. Update massal: Tandai antrean hapus + simpan target kategori
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
        pending_move_added_by: addedBy || "system",
      })
      .in("id", accountIds);

    if (markErr) {
      return NextResponse.json({ success: false, message: markErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil memasukkan ${accountIds.length} akun ke antrean migrasi.`,
      total: accountIds.length,
    });
  } catch (err: any) {
    console.error("[BULK MOVE ERROR]", err);
    return NextResponse.json(
      { success: false, message: err.message || "Terjadi kesalahan" },
      { status: 500 }
    );
  }
}