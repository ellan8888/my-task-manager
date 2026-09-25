import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  // ⭐ Cek API key
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  console.log(`[Cleanup Eggs] Cari order completed < ${sevenDaysAgo}`);

  // === Step 1: Cari order yang completed > 7 hari lalu ===
  const { data: completedOrders, error: orderErr } = await supabaseAdmin
    .from("joki_orders")
    .select("order_id")
    .eq("completed", true)
    .lt("completed_at", sevenDaysAgo);

  if (orderErr) {
    console.error("[Cleanup Eggs] Error fetch orders:", orderErr);
    return NextResponse.json({ error: orderErr.message }, { status: 500 });
  }

  if (!completedOrders || completedOrders.length === 0) {
    return NextResponse.json({
      success: true,
      deleted: 0,
      message: "Nggak ada order yang perlu di-cleanup",
    });
  }

  const orderIds = completedOrders.map((o) => o.order_id);
  console.log(`[Cleanup Eggs] Found ${orderIds.length} orders to cleanup`);

  // === Step 2: Hapus eternal_egg_logs ===
  const { count, error } = await supabaseAdmin
    .from("eternal_egg_logs")
    .delete({ count: "exact" })
    .in("order_id", orderIds);

  if (error) {
    console.error("[Cleanup Eggs] Error delete eggs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[Cleanup Eggs] ✅ Deleted ${count} egg logs`);

  return NextResponse.json({
    success: true,
    deleted: count,
    ordersCleaned: orderIds.length,
  });
}