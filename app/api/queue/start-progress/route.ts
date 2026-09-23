// app/api/queue/start-progress/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  try {
    const { order_id } = await req.json();

    if (!order_id) {
      return NextResponse.json(
        { success: false, message: "order_id wajib" },
        { status: 400 }
      );
    }

    // 1. Ambil order
    const { data: order, error: fetchErr } = await supabase
      .from("joki_orders")
      .select("*")
      .eq("order_id", order_id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json(
        { success: false, message: "Order nggak ketemu" },
        { status: 404 }
      );
    }

    // 2. Cek order progress
    if (order.order_type !== "progress") {
      return NextResponse.json(
        { success: false, message: "Bukan order progress" },
        { status: 400 }
      );
    }

    // 3. Update status ke processing
    const { error: updateErr } = await supabase
      .from("joki_orders")
      .update({
        queue_status: "processing",
        processing_started_at: new Date().toISOString(),
      })
      .eq("order_id", order_id);

    if (updateErr) {
      return NextResponse.json(
        { success: false, message: updateErr.message },
        { status: 500 }
      );
    }

    // 4. Kirim webhook ke Discord → bot.py bakal baca & bikin file
    const webhookUrl = process.env.START_QUEUE_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `🚀 **[START-PROGRESS]**`,
            embeds: [
              {
                title: "🚀 Order Progress Di-Start",
                color: 0x9b59b6,
                fields: [
                  { name: "🆔 Order ID", value: order_id, inline: false },
                  { name: "👤 Username", value: order.roblox_username || "-", inline: true },
                  { name: "🎯 Rarity", value: order.progress_keyword || "-", inline: true },
                  { name: "📦 Target", value: `${order.progress_count || 0}/${order.target_count || 0}`, inline: true },
                  { name: "📝 Produk", value: order.product || "-", inline: false },
                ],
                footer: { text: "Task Manager → Start Progress" },
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        });
      } catch (err) {
        console.error("[start-progress] Gagal kirim webhook:", err);
        // Lanjut aja — jangan fail karena webhook error
      }
    }

    return NextResponse.json({
      success: true,
      order_id,
      queue_status: "processing",
      message: "Order berhasil dimulai",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}