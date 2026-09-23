// app/api/eternal/update-progress/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_id, increment, discord_thread_id, submitted_by, submitted_at } = body;
    
    if (!order_id || !increment) {
      return NextResponse.json(
        { success: false, message: "order_id & increment wajib" },
        { status: 400 }
      );
    }
    
    // 1. Ambil order — FIX: jokian_orders → joki_orders
    const { data: order, error: fetchErr } = await supabase
      .from("joki_orders")                    // ← FIX
      .select("*")
      .eq("order_id", order_id)
      .eq("order_type", "progress")
      .single();
    
    if (fetchErr || !order) {
      return NextResponse.json(
        { success: false, message: "Order nggak ketemu / bukan progress" },
        { status: 404 }
      );
    }
    
    // 2. Hitung progress baru
    const newProgress = Math.min(
      (order.progress_count || 0) + increment,
      order.target_count || 0
    );
    
    // 3. Update — FIX: hapus updated_at
    const { error: updateErr } = await supabase
      .from("joki_orders")                    // ← FIX
      .update({
        progress_count: newProgress,
        // updated_at dihapus karena kolomnya nggak ada
      })
      .eq("order_id", order_id);
    
    if (updateErr) {
      return NextResponse.json(
        { success: false, message: updateErr.message },
        { status: 500 }
      );
    }
    
    // 4. Log submission — FIX: eternal_submissions → progress_submissions
    await supabase
      .from("progress_submissions")           // ← FIX
      .insert({
        order_id,
        increment,
        keyword: order.progress_keyword,      // ← tambah keyword
        discord_thread_id,
        submitted_by,
        submitted_at: submitted_at || new Date().toISOString(),
        new_progress: newProgress,
      });
    
    return NextResponse.json({
      success: true,
      order_id,
      progress_count: newProgress,
      target_count: order.target_count,
      is_complete: newProgress >= order.target_count,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}