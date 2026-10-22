import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, progress_count_raw } = body;

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Username wajib" },
        { status: 400 }
      );
    }

    // Cari order yang aktif buat username ini
        // ⭐ Cari order yang aktif buat username ini (case-insensitive)
    const { data: orders, error: fetchError } = await supabaseAdmin
      .from("joki_orders")
      .select("id, order_id, progress_keyword, target_unit, target_count, progress_count")
      .ilike("roblox_username", username) // <--- UBAH JADI ILIKE
      .in("queue_status", ["waiting_confirm", "processing"]);

    if (fetchError) {
      return NextResponse.json(
        { success: false, message: fetchError.message },
        { status: 500 }
      );
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nggak ada order aktif buat akun ini",
      });
    }

    // Update semua order yang cocok
    for (const order of orders) {
      const { error: updateError } = await supabaseAdmin
        .from("joki_orders")
        .update({
          progress_count: Math.floor(progress_count_raw),
        })
        .eq("id", order.id);

      if (updateError) {
        console.error(`Gagal update ${order.order_id}:`, updateError);
      } else {
        console.log(`Updated progress ${order.order_id}: ${progress_count_raw}`);
      }
    }

    return NextResponse.json({ success: true, message: "Progress updated" });
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}