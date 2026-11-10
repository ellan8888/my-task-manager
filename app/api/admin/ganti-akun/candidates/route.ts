// app/api/admin/ganti-akun/candidates/route.ts
// Calon pengganti: akun kategori sama yang SEDANG DIJUAL di Itemku (status listed)
// dan belum laku. Stok Pribadi TIDAK ikut.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { ACTIVE_STATUSES, SOLD_MARKER, canUseGantiAkun } from "@/lib/replacements";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = getSession(request);
  if (!canUseGantiAkun(session)) {
    return NextResponse.json({ success: false, message: "Harus login" }, { status: 401 });
  }

  const kategori = (new URL(request.url).searchParams.get("kategori") || "").trim();
  if (!kategori) {
    return NextResponse.json({ success: false, message: "kategori wajib" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("accounts_stock")
      .select("username, password, kategori, added_by, used_at, created_at")
      .eq("status", "listed")
      .eq("used", true)
      .eq("logged_out", false)
      .eq("deleted", false)
      .ilike("kategori", kategori)
      .order("used_at", { ascending: true, nullsFirst: false })
      .limit(50);
    if (error) throw error;

    // Sudah dipakai di penggantian lain yang masih berjalan → sembunyikan
    const { data: busy } = await supabaseAdmin
      .from("account_replacements")
      .select("new_username")
      .in("status", ACTIVE_STATUSES);
    const busySet = new Set((busy || []).map((r) => r.new_username.toLowerCase()));

    // Pernah gagal karena "sudah laku di Itemku" (tidak ada tombol Hapus) → jangan ditawarkan lagi
    const { data: sold } = await supabaseAdmin
      .from("account_replacements")
      .select("new_username")
      .ilike("error", `%${SOLD_MARKER}%`);
    (sold || []).forEach((r) => busySet.add(r.new_username.toLowerCase()));

    const list = (data || [])
      .filter((a) => !busySet.has(a.username.toLowerCase()))
      .map((a) => ({
        username: a.username,
        added_by: a.added_by,
        listed_at: a.used_at || a.created_at,
        has_password: !!a.password,
      }));

    return NextResponse.json({ success: true, data: list });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : (err as { message?: string })?.message || "Terjadi kesalahan";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
