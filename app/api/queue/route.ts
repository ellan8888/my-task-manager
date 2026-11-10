// app/api/queue/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession, isBotRequest } from "@/lib/auth";
import { PUBLIC_ORDER_COLUMNS } from "@/lib/publicOrder";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const orderType = searchParams.get("order_type");
    const manualComplete = searchParams.get("manual_complete_triggered");
    const botRetryRequested = searchParams.get("bot_retry_requested"); // ⭐ BARU
    const botRefetchRequested = searchParams.get("bot_refetch_requested"); // ⭐ ambil ulang data
    let order_id = searchParams.get("order_id");

    // ✅ CLEAN ORDER ID
    if (order_id) {
      order_id = order_id.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim();
    }

    // Bot & user login → data lengkap. Pengunjung (halaman antrean publik) → kolom aman saja.
    const session = getSession(request);
    const trusted = isBotRequest(request) || !!session;

    // ?mine=1 → order milik user yang login (halaman Jokian)
    const mine = searchParams.get("mine") === "1";
    if (mine && !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let query = supabaseAdmin
      .from("joki_orders")
      .select(trusted ? "*" : PUBLIC_ORDER_COLUMNS);

    if (mine && session) {
      query = query.eq("joki_name", session.username);
    }

    // ═══════════════════════════════════════════════════════════
    // ⭐ LOGIC FILTER "completed"
    //    - manual_complete_triggered=true → JANGAN filter completed
    //    - bot_retry_requested=true → JANGAN filter completed
    //      (karena order retry bisa punya status completed atau belum)
    //    - Selain itu → filter completed=false
    // ═══════════════════════════════════════════════════════════
    if (manualComplete === "true") {
      query = query.eq("manual_complete_triggered", true);
      // ⚠️ JANGAN filter completed
    } else if (botRetryRequested === "true") {
      query = query.eq("bot_retry_requested", true); // ⭐ FIX
      // ⚠️ JANGAN filter completed (order retry bisa ada yang completed)
    } else if (botRefetchRequested === "true") {
      // ⭐ Order yang minta bot ambil ulang datanya dari Itemku
      query = query.eq("bot_refetch_requested", true).eq("completed", false);
    } else if (searchParams.get("any_status") === "1" && order_id) {
      // Halaman detail order: tetap tampil walau sudah selesai
    } else {
      query = query.eq("completed", false);
    }

    // Filter by order_id (spesifik)
    if (order_id) {
      query = query.eq("order_id", order_id);
    } else if (status) {
      query = query.eq("queue_status", status);
    }

    // ⭐ FILTER order_type
    if (orderType) {
      query = query.eq("order_type", orderType);
    }

    // Order
        // Order
    if (mine) {
      query = query
        .order("schedule_date", { ascending: true })
        .order("schedule_time", { ascending: true });
    } else if (status === "queued") {
      query = query.order("queue_position", { ascending: true, nullsFirst: false });
    } else if (status === "processing") {
      // ⭐ FIX: nullsFirst: false, biar order yang processing_started_at = NULL tetap muncul
      query = query.order("processing_started_at", { ascending: true, nullsFirst: false });
    } else {
      query = query.order("created_at", { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      count: data?.length || 0,
      data: data || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}