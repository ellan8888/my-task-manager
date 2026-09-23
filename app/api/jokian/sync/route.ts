// app/api/jokian/sync/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      order_id,
      roblox_username,
      product,
      joki_name,
      schedule_date,
      schedule_time,
      note,
      // ⭐ FIELD PROGRESS — TAMBAH 4 INI:
      order_type,
      progress_keyword,
      target_count,
      progress_count,
      confirmed_by,
      webhook_url,
    } = body;

    // Validasi data wajib
    if (!order_id) {
      return NextResponse.json(
        { success: false, error: "order_id wajib diisi." },
        { status: 400 }
      );
    }

    // Clean order ID — hapus suffix (ID), (MY), (SG), dll
    const cleanedOrderId = order_id.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim();

    // Cek dulu order-nya udah ada atau belum
    const { data: existingOrder } = await supabaseAdmin
      .from("joki_orders")
      .select("order_id, order_type")
      .eq("order_id", cleanedOrderId)
      .maybeSingle();

    // ⭐ SUSUN PAYLOAD — cuma tambah field progress kalau order_type = "progress"
    const upsertData: Record<string, any> = {
      order_id: cleanedOrderId,
      roblox_username: roblox_username || null,
      product: product || null,
      joki_name: joki_name || null,
      schedule_date: schedule_date || null,
      schedule_time: schedule_time || null,
      note: note || null,
    };

    // Kalau ini progress order, tambah field progress
    if (order_type === "progress") {
      upsertData.order_type = "progress";
      upsertData.progress_keyword = progress_keyword || null;
      upsertData.target_count = target_count || 0;
      upsertData.progress_count = progress_count || 0;
      if (confirmed_by !== undefined) upsertData.confirmed_by = confirmed_by;
      if (webhook_url !== undefined) upsertData.webhook_url = webhook_url;
    } else if (order_type === "countdown") {
      // Kalau countdown eksplisit
      upsertData.order_type = "countdown";
    }
    // Kalau order_type nggak dikirim, biarin default dari DB

    // Upsert berdasarkan order_id
    const { data, error } = await supabaseAdmin
      .from("joki_orders")
      .upsert(upsertData, {
        onConflict: "order_id",
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Gagal sync Jokian:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log(
      `✅ [Sync] Order ${cleanedOrderId} tersimpan`,
      order_type === "progress" 
        ? `(PROGRESS — ${progress_keyword} ${progress_count}/${target_count})`
        : "(countdown)"
    );

    return NextResponse.json({
      success: true,
      message: "Jokian berhasil disinkronkan.",
      data,
    });
  } catch (error: any) {
    console.error("❌ API Jokian error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Terjadi kesalahan pada API.",
      },
      { status: 500 }
    );
  }
}