import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,       // ⭐ GANTI ENV VAR
  process.env.SUPABASE_SERVICE_ROLE_KEY!       // ⭐ GANTI ENV VAR
);

export async function POST(req: NextRequest) {
  try {
    const { order_id } = await req.json();

    if (!order_id) {
      return NextResponse.json(
        { success: false, message: "order_id wajib" },
        { status: 400 }
      );
    }

    // Clean order_id
    const cleanedOrderId = order_id.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim();

    // 1. Ambil order
    const { data: order, error: fetchErr } = await supabase
      .from("joki_orders")
      .select("*")
      .eq("order_id", cleanedOrderId)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json(
        { success: false, message: "Order nggak ketemu" },
        { status: 404 }
      );
    }

    if (order.order_type !== "progress") {
      return NextResponse.json(
        { success: false, message: "Bukan order progress" },
        { status: 400 }
      );
    }

    // ⭐ 2. Update DB: queue_status = "processing" + RESET start_chat_sent = false
    // ⭐ INI YANG BIKIN BOT DETECT & KIRIM CHAT
    const { error: updateErr } = await supabase
      .from("joki_orders")
      .update({
        queue_status: "processing",
        processing_started_at: new Date().toISOString(),
        start_chat_sent: false,   // ⭐ RESET — biar bot kirim chat
      })
      .eq("order_id", cleanedOrderId);

    if (updateErr) {
      return NextResponse.json(
        { success: false, message: updateErr.message },
        { status: 500 }
      );
    }

    // 3. Kirim webhook Discord (opsional)
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
                  { name: "🆔 Order ID", value: cleanedOrderId, inline: false },
                  { name: "👤 Username", value: order.roblox_username || "-", inline: true },
                  { name: "🎯 Rarity", value: order.progress_keyword || "-", inline: true },
                  { name: "📦 Target", value: `${order.progress_count || 0}/${order.target_count || 0}`, inline: true },
                ],
                footer: { text: "Task Manager → Start Progress" },
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        });
      } catch (err) {
        console.error("[start-progress] Gagal kirim webhook:", err);
      }
    }

    return NextResponse.json({
      success: true,
      order_id: cleanedOrderId,
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