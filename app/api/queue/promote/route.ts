// app/api/queue/promote/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_PARALLEL = 11;

export async function POST() {
  try {
    // 1. Hitung total active (waiting_confirm + processing)
    const { data: activeOrders, error: activeError } = await supabaseAdmin
      .from("joki_orders")
      .select("queue_status")
      .eq("completed", false)
      .in("queue_status", ["waiting_confirm", "processing"]);
    
    if (activeError) {
      return NextResponse.json({ error: activeError.message }, { status: 500 });
    }
    
    const activeCount = activeOrders?.length || 0;
    const availableSlots = MAX_PARALLEL - activeCount;
    
    if (availableSlots <= 0) {
      return NextResponse.json({
        success: true,
        promoted: 0,
        message: `Slots full (${activeCount}/${MAX_PARALLEL})`,
      });
    }
    
    // 2. Ambil order dari antrian (FIFO)
    const { data: queuedOrders, error: queuedError } = await supabaseAdmin
      .from("joki_orders")
      .select("*")
      .eq("queue_status", "queued")
      .eq("completed", false)
      .order("queue_position", { ascending: true })
      .limit(availableSlots);
    
    if (queuedError) {
      return NextResponse.json({ error: queuedError.message }, { status: 500 });
    }
    
    if (!queuedOrders || queuedOrders.length === 0) {
      return NextResponse.json({ success: true, promoted: 0 });
    }
    
    // 3. Update status order yang naik
    const promotedIds = queuedOrders.map(o => o.order_id);
    
    const { error: updateError } = await supabaseAdmin
      .from("joki_orders")
      .update({
        queue_status: "waiting_confirm",
        queue_position: null,
      })
      .in("order_id", promotedIds);
    
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    
    console.log(`✅ Promoted ${promotedIds.length} order(s):`, promotedIds);
    
    // 4. Geser posisi antrian yang lain
    const { data: remainingQueued } = await supabaseAdmin
      .from("joki_orders")
      .select("order_id, queue_position")
      .eq("queue_status", "queued")
      .eq("completed", false)
      .order("queue_position", { ascending: true });
    
    if (remainingQueued && remainingQueued.length > 0) {
      for (let i = 0; i < remainingQueued.length; i++) {
        const newPos = i + 1;
        if (remainingQueued[i].queue_position !== newPos) {
          await supabaseAdmin
            .from("joki_orders")
            .update({ queue_position: newPos })
            .eq("order_id", remainingQueued[i].order_id);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      promoted: promotedIds.length,
      order_ids: promotedIds,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}