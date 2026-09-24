// app/api/queue/start-progress/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// ⭐ Path file — HARUS SAMA dengan yang dibaca bot Python
const START_PROGRESS_FILE = path.join(
  process.cwd(),
  "start_progress_from_dashboard.json"
);

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

    // ═══════════════════════════════════════════════════════════
    // ⭐ 4. TULIS FILE — INI YANG BOT PYTHON BACA
    // ═══════════════════════════════════════════════════════════
    try {
      let existing: any[] = [];

      if (fs.existsSync(START_PROGRESS_FILE)) {
        try {
          const raw = fs.readFileSync(START_PROGRESS_FILE, "utf-8");
          existing = JSON.parse(raw);
          if (!Array.isArray(existing)) existing = [];
        } catch {
          existing = [];
        }
      }

      // Cek duplikat
      const alreadyExists = existing.some(
        (e: any) => e.order_id === order_id
      );

      if (!alreadyExists) {
        existing.push({
          order_id: order_id,
          label: order.progress_keyword
            ? order.progress_keyword.charAt(0).toUpperCase() +
              order.progress_keyword.slice(1) +
              " Egg"
            : "Eternal Egg",
          target_count: order.target_count ?? 10,
          requested_at: new Date().toISOString(),
        });

        fs.writeFileSync(
          START_PROGRESS_FILE,
          JSON.stringify(existing, null, 2),
          "utf-8"
        );

        console.log(
          `[start-progress] ✅ File ditulis: ${START_PROGRESS_FILE}`
        );
      } else {
        console.log(
          `[start-progress] ⏭️ Order ${order_id} udah ada di file — skip`
        );
      }
    } catch (fileErr: any) {
      console.error("[start-progress] ❌ Gagal tulis file:", fileErr);
    }

    // 5. Kirim webhook ke Discord (opsional)
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
                  {
                    name: "👤 Username",
                    value: order.roblox_username || "-",
                    inline: true,
                  },
                  {
                    name: "🎯 Rarity",
                    value: order.progress_keyword || "-",
                    inline: true,
                  },
                  {
                    name: "📦 Target",
                    value: `${order.progress_count || 0}/${order.target_count || 0}`,
                    inline: true,
                  },
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