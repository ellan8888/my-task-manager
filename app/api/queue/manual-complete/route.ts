// app/api/queue/manual-complete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

    // 2. Cek udah selesai apa belum
    if (order.completed_by_bot === true || order.queue_status === "completed") {
      return NextResponse.json({
        success: true,
        message: "Order udah selesai — skip",
        skipped: true,
      });
    }

    // ⭐ 3. Update DB — 2 FLAG PENTING:
    //    - manual_complete_triggered = true → trigger bot
    //    - completed = true → card LANGSUNG HILANG dari list
    const { error: updateErr } = await supabase
      .from("joki_orders")
      .update({
        manual_complete_triggered: true,
        manual_complete_at: new Date().toISOString(),
        completed: true,                     // ⭐ INI YANG BIKIN CARD HILANG
        completed_at: new Date().toISOString(),
      })
      .eq("order_id", order_id);

    if (updateErr) {
      return NextResponse.json(
        { success: false, message: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order_id,
      message: "Order ditandai selesai — bot bakal proses sebentar lagi",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}