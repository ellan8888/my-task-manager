// app/api/jokian/note/route.ts
// Simpan catatan pribadi penjoki di card jokian (kolom joki_orders.my_note).
// Terpisah dari catatan Itemku, jadi tidak pernah ditimpa bot.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, isSuperadmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_LENGTH = 1000;

export async function POST(request: Request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
    if (!orderId) {
      return NextResponse.json({ success: false, message: "order_id wajib" }, { status: 400 });
    }
    if (body.my_note != null && typeof body.my_note !== "string") {
      return NextResponse.json({ success: false, message: "Catatan harus berupa teks" }, { status: 400 });
    }
    const note = typeof body.my_note === "string" ? body.my_note.trim().slice(0, MAX_LENGTH) : "";

    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("joki_orders")
      .select("order_id, joki_name")
      .eq("order_id", orderId)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ success: false, message: fetchErr.message }, { status: 500 });
    }
    if (!order) {
      return NextResponse.json({ success: false, message: "Order tidak ditemukan" }, { status: 404 });
    }
    // User biasa hanya boleh untuk order miliknya
    if (!isSuperadmin(session) && (order.joki_name || "").toLowerCase() !== session.username.toLowerCase()) {
      return NextResponse.json({ success: false, message: "Bukan order kamu" }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("joki_orders")
      .update({ my_note: note || null })
      .eq("order_id", orderId);

    if (error) {
      const missingColumn = /my_note/i.test(error.message) && /(column|schema cache)/i.test(error.message);
      return NextResponse.json(
        {
          success: false,
          message: missingColumn
            ? "Kolom catatan belum ada — jalankan sql/005_joki_orders_my_note.sql di Supabase dulu"
            : error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, my_note: note || null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
