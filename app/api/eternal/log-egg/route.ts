// app/api/eternal/log-egg/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  try {
    const body = await req.json();
    const {
      roblox_username,
      egg_name,
      rarity,
      area,
      size,
      weight,
      earns,
      discord_message_id,
      discord_channel_id,
    } = body;

    if (!roblox_username || !egg_name || !rarity) {
      return NextResponse.json(
        { success: false, message: "roblox_username, egg_name, rarity wajib" },
        { status: 400 }
      );
    }

    // 1. Cari order aktif berdasarkan roblox_username
    const { data: orders, error: fetchErr } = await supabase
      .from("joki_orders")
      .select("*")
      .eq("roblox_username", roblox_username)
      .eq("order_type", "progress")
      .order("created_at", { ascending: true });

    if (fetchErr) {
      return NextResponse.json(
        { success: false, message: fetchErr.message },
        { status: 500 }
      );
    }

    if (!orders || orders.length === 0) {
      // Tetep log ke DB meski nggak ada order (buat audit)
      await supabase.from("eternal_egg_logs").insert({
        order_id: null,
        roblox_username,
        egg_name,
        rarity: rarity.toLowerCase(),
        area,
        size,
        weight,
        earns,
        counted: false,
        discord_message_id,
        discord_channel_id,
      });

      return NextResponse.json({
        success: true,
        matched: false,
        message: "Egg di-log, tapi nggak ada order aktif untuk user ini",
      });
    }

    // 2. Ambil order pertama (FIFO) sebagai match
    //    Kalau mau matching per rarity, ubah logic di sini
    const order = orders[0];
    const orderRarity = (order.progress_keyword || "").toLowerCase();
    const eggRarity = rarity.toLowerCase();

    // 3. Cek apakah rarity match
    const isCounted = orderRarity === eggRarity;

    // 4. INSERT log egg (semua egg, counted atau nggak)
    const { error: insertErr } = await supabase
      .from("eternal_egg_logs")
      .insert({
        order_id: order.order_id,
        roblox_username,
        egg_name,
        rarity: eggRarity,
        area,
        size,
        weight,
        earns,
        counted: isCounted,
        discord_message_id,
        discord_channel_id,
      });

    if (insertErr) {
      return NextResponse.json(
        { success: false, message: insertErr.message },
        { status: 500 }
      );
    }

    // 5. Kalau counted → increment progress_count
    let newProgress = order.progress_count || 0;
    let isComplete = false;

    if (isCounted) {
      newProgress = Math.min(
        (order.progress_count || 0) + 1,
        order.target_count || 0
      );

      const { error: updateErr } = await supabase
        .from("joki_orders")
        .update({ progress_count: newProgress })
        .eq("order_id", order.order_id);

      if (updateErr) {
        return NextResponse.json(
          { success: false, message: updateErr.message },
          { status: 500 }
        );
      }

      isComplete = newProgress >= (order.target_count || 0);
    }

    // 6. Hitung summary per rarity (buat info)
    const { data: raritySummary } = await supabase
      .from("eternal_egg_logs")
      .select("rarity")
      .eq("order_id", order.order_id);

    const summary: Record<string, number> = {};
    for (const row of raritySummary || []) {
      summary[row.rarity] = (summary[row.rarity] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      matched: true,
      order_id: order.order_id,
      egg_name,
      egg_rarity: eggRarity,
      order_rarity: orderRarity,
      counted: isCounted,
      progress_count: newProgress,
      target_count: order.target_count,
      is_complete: isComplete,
      summary,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}