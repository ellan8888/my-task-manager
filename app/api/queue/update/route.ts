// app/api/queue/update/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ⭐ LIST FIELD YANG BOLEH DI-UPDATE
// Cegah update field random yang bisa ngerusak data
const ALLOWED_FIELDS = [
  "queue_status",
  "queue_position",
  "processing_started_at",
  "estimated_end_at",
  "completed",
  "completed_by_bot",
  "completed_at",
  "confirm_token",
  "token_expires_at",
  "bot_process_failed",
  "bot_failed_reason",
  "bot_failed_at",
  "bot_failed_source",
  "bot_failed_context",
  "start_chat_sent",
  "manual_complete_triggered",
  "manual_retry_count",
  "bot_retry_requested",
] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { order_id, ...rawUpdates } = body;

    if (!order_id) {
      return NextResponse.json(
        { success: false, message: "order_id required" },
        { status: 400 }
      );
    }

    // ✅ CLEAN ORDER ID
    const cleanedOrderId = order_id.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim();

    // ⭐ FILTER — cuma field yang di-allow
    const updates: Record<string, any> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in rawUpdates) {
        // ⭐ PAKAI `in` — jadi `false`, `null`, `0` tetap di-copy
        updates[key] = rawUpdates[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, message: "No valid fields to update" },
        { status: 400 }
      );
    }

    console.log(`[Queue Update] ${order_id} → ${cleanedOrderId}`);
    console.log(`[Queue Update] Fields:`, updates);

    // ⭐⭐ GUARD: Kalau queue_status = "completed", force reset semua flag gagal
    // Biar nggak ada state kontradiktif
    if (updates.queue_status === "completed") {
      updates.bot_process_failed = false;
      updates.bot_failed_reason = null;
      updates.bot_failed_at = null;
      updates.bot_failed_source = null;
      updates.bot_failed_context = null;
      console.log(
        `[Queue Update] ⚠️ Force reset flag gagal (queue_status = completed)`
      );
    }

    // ✅ UPDATE
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

    if (!data || data.length === 0) {
      console.warn(`⚠️ 0 row updated untuk: ${cleanedOrderId}`);
      return NextResponse.json(
        {
          success: false,
          message: `Order ${cleanedOrderId} tidak ditemukan`,
          order_id_input: order_id,
          order_id_cleaned: cleanedOrderId,
          rows_affected: 0,
        },
        { status: 404 }
      );
    }

    console.log(`✅ Updated ${data.length} row:`, data[0]);

    // Promote antrian kalau completed
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