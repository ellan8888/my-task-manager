// app/api/eternal/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { order_id, confirmed_by, webhook_url } = await req.json();
    
    if (!order_id) {
      return NextResponse.json({ success: false, message: "order_id wajib" }, { status: 400 });
    }
    
    // Ambil order buat cek
    const { data: order, error: fetchErr } = await supabase
      .from("joki_orders")
      .select("*")
      .eq("order_id", order_id)
      .single();
    
    if (fetchErr || !order) {
      return NextResponse.json({ success: false, message: "Order nggak ketemu" }, { status: 404 });
    }
    
    // Update confirmed_by
    const { error } = await supabase
      .from("joki_orders")
      .update({ confirmed_by })
      .eq("order_id", order_id);
    
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
    
    // Kirim webhook notif kalau ada
    const targetWebhook = webhook_url || order.webhook_url;
    if (targetWebhook) {
      await fetch(targetWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `✅ Order \`${order_id}\` dikonfirmasi oleh **${confirmed_by}**\nProgress: ${order.progress_count}/${order.target_count}`,
        }),
      }).catch(() => {});
    }
    
    return NextResponse.json({ success: true, order_id, confirmed_by });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}