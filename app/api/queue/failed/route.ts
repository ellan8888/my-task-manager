// app/api/queue/failed/route.ts — daftar order yang gagal diproses bot
// Dipakai oleh: /admin/order-gagal (list) dan AdminSidebar (badge jumlah)
//
// Catatan: file ini sebelumnya berisi salinan /api/queue/update (POST saja),
// sehingga GET dari halaman Order Gagal selalu gagal. POST itu tidak dipanggil
// siapa pun (bot memakai /api/queue/update), jadi diganti dengan GET.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, isSuperadmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // /api/queue di-bypass middleware → cek login di sini
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    let query = supabaseAdmin
      .from("joki_orders")
      .select("*")
      .eq("bot_process_failed", true)
      .order("bot_failed_at", { ascending: false, nullsFirst: false });

    if (!isSuperadmin(session)) query = query.eq("joki_name", session.username);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Halaman memakai `product_title`, kolom di tabel bernama `product`
    const rows = (data || []).map((o) => ({
      ...o,
      product_title: o.product_title ?? o.product ?? null,
    }));

    return NextResponse.json({ success: true, data: rows, count: rows.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
