// app/api/queue/refetch/route.ts
// Dipanggil tombol "Ambil ulang data" di card jokian.
// Tidak mengambil data sendiri (app tidak bisa login ke Itemku) —
// hanya memberi tanda supaya bot mengambil ulang dari detail_url.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, isSuperadmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // /api/queue di-bypass middleware → cek login di sini
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { order_id } = await request.json().catch(() => ({}));
    if (!order_id) {
      return NextResponse.json({ success: false, message: "order_id wajib" }, { status: 400 });
    }

    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("joki_orders")
      .select("order_id, joki_name, detail_url, bot_refetch_requested")
      .eq("order_id", order_id)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ success: false, message: fetchErr.message }, { status: 500 });
    }
    if (!order) {
      return NextResponse.json({ success: false, message: "Order tidak ditemukan" }, { status: 404 });
    }
    // User biasa hanya boleh untuk order miliknya
    if (!isSuperadmin(session) && order.joki_name !== session.username) {
      return NextResponse.json({ success: false, message: "Bukan order kamu" }, { status: 403 });
    }
    if (!order.detail_url) {
      return NextResponse.json(
        { success: false, message: "Order ini belum punya link Itemku, jadi bot tidak tahu harus membuka halaman mana" },
        { status: 400 }
      );
    }
    if (order.bot_refetch_requested) {
      return NextResponse.json({ success: true, message: "Sudah dalam antrean bot", already: true });
    }

    const { error: updateErr } = await supabaseAdmin
      .from("joki_orders")
      .update({
        bot_refetch_requested: true,
        bot_refetch_at: new Date().toISOString(),
        bot_refetch_error: null,
      })
      .eq("order_id", order_id);

    if (updateErr) {
      return NextResponse.json({ success: false, message: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Bot akan mengambil ulang data sebentar lagi" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
