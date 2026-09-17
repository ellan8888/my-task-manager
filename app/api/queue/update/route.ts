// app/api/queue/update/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_PARALLEL = 11;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { order_id, ...updates } = body;

    if (!order_id) {
      return NextResponse.json(
        { success: false, message: "order_id required" },
        { status: 400 }
      );
    }

    // ✅ CLEAN ORDER ID — hapus suffix (ID), (MY), (SG), dll
    const cleanedOrderId = order_id.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim();

    console.log(`[Queue Update] ${order_id} → ${cleanedOrderId}`);
    console.log(`[Queue Update] Fields:`, updates);

    // ✅ PAKAI .select() — biar tau berapa row yang ke-update
    const { data, error } = await supabaseAdmin
      .from("joki_orders")
      .update(updates)
      .eq("order_id", cleanedOrderId)
      .select();

    if (error) {
      console.error(`❌ Error update:`, error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    // ✅ CEK: apakah beneran ada row yang di-update
    if (!data || data.length === 0) {
      console.warn(`⚠️ 0 row updated untuk: ${cleanedOrderId}`);
      return NextResponse.json(
        {
          success: false,
          message: `Order ${cleanedOrderId} tidak ditemukan di database`,
          order_id_input: order_id,
          order_id_cleaned: cleanedOrderId,
          rows_affected: 0,
        },
        { status: 404 }
      );
    }

    console.log(`✅ Updated ${data.length} row:`, data[0]);

    // Kalau update adalah "completed", naikkan antrian
    if (updates.queue_status === "completed" || updates.completed === true) {
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      fetch(`${baseUrl}/api/queue/promote`, { method: "POST" }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      data: data[0],
      rows_affected: data.length,
    });
  } catch (error: any) {
    console.error("❌ API error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}