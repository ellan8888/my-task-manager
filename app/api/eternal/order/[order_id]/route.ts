// app/api/eternal/order/[order_id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ order_id: string }> }
) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { order_id } = await params;

  if (!order_id) {
    return NextResponse.json(
      { success: false, message: "order_id wajib" },
      { status: 400 }
    );
  }

  // 1. Ambil order
  const { data: order, error: orderErr } = await supabase
    .from("joki_orders")
    .select("*")
    .eq("order_id", order_id)
    .single();

  if (orderErr || !order) {
    return NextResponse.json(
      { success: false, message: "Order nggak ketemu" },
      { status: 404 }
    );
  }

  // 2. Ambil semua egg logs buat order ini
  const { data: eggs, error: eggsErr } = await supabase
    .from("eternal_egg_logs")
    .select("*")
    .eq("order_id", order_id)
    .order("created_at", { ascending: true });

  if (eggsErr) {
    return NextResponse.json(
      { success: false, message: eggsErr.message },
      { status: 500 }
    );
  }

  // 3. Group egg by rarity
  const grouped: Record<string, any[]> = {};
  for (const egg of eggs || []) {
    const rarity = (egg.rarity || "unknown").toLowerCase();
    if (!grouped[rarity]) grouped[rarity] = [];
    grouped[rarity].push({
      egg_name: egg.egg_name,
      area: egg.area,
      size: egg.size,
      weight: egg.weight,
      counted: egg.counted,
      created_at: egg.created_at,
    });
  }

  // 4. Hitung summary
  const totalCollected = eggs?.length || 0;
  const countedEggs = eggs?.filter((e) => e.counted).length || 0;
  const targetRarity = (order.progress_keyword || "").toLowerCase();

  return NextResponse.json({
    success: true,
    data: {
      order: {
        order_id: order.order_id,
        product: order.product,
        roblox_username: order.roblox_username,
        joki_name: order.joki_name,
        queue_status: order.queue_status,
        progress_keyword: targetRarity,
        progress_count: order.progress_count,
        target_count: order.target_count,
        is_complete: (order.progress_count || 0) >= (order.target_count || 0),
      },
      eggs: {
        total: totalCollected,
        counted: countedEggs,
        by_rarity: grouped,
      },
    },
  });
}