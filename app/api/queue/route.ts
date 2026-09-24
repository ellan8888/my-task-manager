import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const orderType = searchParams.get("order_type");   // ⭐ BARU
    let order_id = searchParams.get("order_id");

    // ✅ CLEAN ORDER ID
    if (order_id) {
      order_id = order_id.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim();
    }

    let query = supabaseAdmin
      .from("joki_orders")
      .select("*")
      .eq("completed", false);

    if (order_id) {
      query = query.eq("order_id", order_id);
    } else if (status) {
      query = query.eq("queue_status", status);
    }

    // ⭐ FILTER order_type
    if (orderType) {
      query = query.eq("order_type", orderType);
    }

    if (status === "queued") {
      query = query.order("queue_position", { ascending: true });
    } else if (status === "processing") {
      query = query.order("processing_started_at", { ascending: true });
    } else {
      query = query.order("created_at", { ascending: true });
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      count: data?.length || 0,
      data: data || [],   // ⭐ GANTI dari "orders" jadi "data"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}