// app/api/queue/check-completed/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    const now = new Date().toISOString();
    
    // 1. Cari order processing yang countdown-nya sudah habis
    const { data: expired, error: findError } = await supabaseAdmin
      .from("joki_orders")
      .select("*")
      .eq("queue_status", "processing")
      .eq("completed", false)
      .lte("estimated_end_at", now);
    
    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }
    
    if (!expired || expired.length === 0) {
      return NextResponse.json({ success: true, completed: 0 });
    }
    
    // 2. Mark as completed
    const expiredIds = expired.map(o => o.order_id);
    
    const { error: updateError } = await supabaseAdmin
  .from("joki_orders")
  .update({
    queue_status: "completed",
    completed_by_bot: true,     // ← TAMBAH INI (biar buram + badge "Selesai oleh Bot")
    completed_at: now,          // ← TAMBAH INI (biar ada timestamp selesai)
    // ❌ JANGAN set completed = true — biar card tetap muncul di home
  })
  .in("order_id", expiredIds);
    
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    
    console.log(`✅ Auto-completed ${expired.length} order(s):`, expiredIds);
    
    // 3. Naikkan antrian (biar bot yang handle, atau di sini langsung)
    // Kita panggil endpoint untuk naikkan antrian
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    fetch(`${baseUrl}/api/queue/promote`, { method: "POST" }).catch(() => {});
    
    return NextResponse.json({
      success: true,
      completed: expired.length,
      order_ids: expiredIds,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}