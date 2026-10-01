// app/api/queue/update/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ══════════════════════════════════════════════════════════════
// ⭐ WHITELIST FIELD — cuma field ini yang boleh di-update
// Cegah update field random yang bisa ngerusak data
// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
// ⭐ FIELD YANG WAJIB DI-RESET KALAU queue_status = completed
// Biar nggak ada state kontradiktif: completed + failed
// ══════════════════════════════════════════════════════════════
const FAILED_FLAGS = [
  "bot_process_failed",
  "bot_failed_reason",
  "bot_failed_at",
  "bot_failed_source",
  "bot_failed_context",
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

    // ✅ CLEAN ORDER ID — hapus suffix (ID), (MY), (SG), dll
    const cleanedOrderId = order_id.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim();

    // ══════════════════════════════════════════════════════════
    // ⭐ STEP 1: FILTER FIELD — cuma yang di-whitelist
    // Pakai `in` biar `false`, `null`, `0` tetap di-copy
    // ══════════════════════════════════════════════════════════
    const updates: Record<string, any> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in rawUpdates) {
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

    // ══════════════════════════════════════════════════════════
    // ⭐ STEP 2: GUARD COMPLETED
    // Kalau queue_status = "completed", force reset semua flag gagal
    // Biar nggak ada state kontradiktif
    // ══════════════════════════════════════════════════════════
    if (updates.queue_status === "completed") {
      for (const flag of FAILED_FLAGS) {
        // `bot_process_failed` di-set false, sisanya null
        if (flag === "bot_process_failed") {
          updates[flag] = false;
        } else {
          updates[flag] = null;
        }
      }
      console.log(
        `[Queue Update] ⚠️ Force reset flag gagal (queue_status = completed)`
      );
    }

    // ══════════════════════════════════════════════════════════
    // ⭐ STEP 3: GUARD PROCESSING
    // Kalau queue_status = "processing", pastiin nggak ada flag gagal
    // (order yang lagi processing nggak mungkin gagal)
    // ══════════════════════════════════════════════════════════
    if (updates.queue_status === "processing") {
      // Cuma reset kalau bot_process_failed dikirim true
      // (biar nggak nimpa kalau cuma update processing_started_at)
      if (updates.bot_process_failed === true) {
        console.log(
          `[Queue Update] ⚠️ Order processing kok di-set failed? — skip flag gagal`
        );
        delete updates.bot_process_failed;
        delete updates.bot_failed_reason;
        delete updates.bot_failed_at;
        delete updates.bot_failed_source;
        delete updates.bot_failed_context;
      }
    }

    // ══════════════════════════════════════════════════════════
    // ⭐ STEP 4: UPDATE DB
    // ══════════════════════════════════════════════════════════
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

    // ══════════════════════════════════════════════════════════
    // ⭐ STEP 5: PROMOTE ANTRIAN (kalau completed)
    // ══════════════════════════════════════════════════════════
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