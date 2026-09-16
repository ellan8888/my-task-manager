// app/api/queue/update/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_PARALLEL = 11;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { order_id, ...updates } = body;
    
    if (!order_id) {
      return NextResponse.json({ success: false, message: "order_id required" }, { status: 400 });
    }
    
    // ✅ CLEAN ORDER ID — hapus suffix (ID), (MY), (SG), dll
    order_id = order_id.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim();
    
    const { error } = await supabaseAdmin
      .from("joki_orders")
      .update(updates)
      .eq("order_id", order_id);
    
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
    
    // Kalau update adalah "completed", naikkan antrian
    if (updates.queue_status === "completed" || updates.completed === true) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      fetch(`${baseUrl}/api/queue/promote`, { method: "POST" }).catch(() => {});
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}