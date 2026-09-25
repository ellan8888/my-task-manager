import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  // ⭐ Cek API key
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Reclaim Eggs] Mulai scan orphan eggs...");

  // ⭐ 1. Cari semua egg dengan order_id = NULL
  const { data: orphanEggs, error: eggErr } = await supabaseAdmin
    .from("eternal_egg_logs")
    .select("id, roblox_username")
    .is("order_id", null)
    .not("roblox_username", "is", null);

  if (eggErr) {
    console.error("[Reclaim Eggs] Query error:", eggErr);
    return NextResponse.json({ error: eggErr.message }, { status: 500 });
  }

  if (!orphanEggs || orphanEggs.length === 0) {
    console.log("[Reclaim Eggs] Nggak ada orphan egg");
    return NextResponse.json({
      success: true,
      message: "Nggak ada orphan eggs",
      reclaimed: 0,
    });
  }

  // ⭐ 2. Group by roblox_username
  const byUsername = new Map<string, number[]>();
  for (const egg of orphanEggs) {
    const uname = (egg.roblox_username || "").trim();
    if (!uname) continue;
    if (!byUsername.has(uname)) byUsername.set(uname, []);
    byUsername.get(uname)!.push(egg.id);
  }

  console.log(
    `[Reclaim Eggs] ${orphanEggs.length} orphan eggs, ${byUsername.size} username unik`
  );

  let totalReclaimed = 0;
  const details: any[] = [];

  // ⭐ 3. Untuk tiap username, cari order yang match exact
  for (const [username, eggIds] of byUsername.entries()) {
    const { data: order } = await supabaseAdmin
      .from("joki_orders")
      .select("order_id, progress_count, target_count")
      .eq("roblox_username", username) // ⭐ EXACT MATCH
      .eq("order_type", "progress")
      .eq("queue_status", "processing")
      .eq("completed", false)
      .maybeSingle();

    if (!order) {
      console.log(`[Reclaim Eggs] Nggak ada order aktif untuk '${username}'`);
      continue;
    }

    // Update order_id di egg
    const { error: updateErr } = await supabaseAdmin
      .from("eternal_egg_logs")
      .update({ order_id: order.order_id })
      .in("id", eggIds);

    if (updateErr) {
      console.error(`[Reclaim Eggs] Gagal update egg:`, updateErr);
      continue;
    }

    // Hitung ulang progress_count
    const { count: newCount } = await supabaseAdmin
      .from("eternal_egg_logs")
      .select("*", { count: "exact", head: true })
      .eq("order_id", order.order_id)
      .eq("counted", true);

    // Update progress_count di joki_orders
    await supabaseAdmin
      .from("joki_orders")
      .update({ progress_count: newCount || 0 })
      .eq("order_id", order.order_id);

    totalReclaimed += eggIds.length;
    details.push({
      username,
      order_id: order.order_id,
      eggs_reclaimed: eggIds.length,
      new_progress_count: newCount || 0,
    });

    console.log(
      `[Reclaim Eggs] ✅ '${username}' → ${eggIds.length} egg di-reclaim ` +
      `(progress: ${newCount})`
    );
  }

  return NextResponse.json({
    success: true,
    total_reclaimed: totalReclaimed,
    details,
  });
}