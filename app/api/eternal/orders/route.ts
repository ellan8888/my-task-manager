// app/api/eternal/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  try {
    const { searchParams } = new URL(req.url);
    const roblox_username = searchParams.get("roblox_username");
    const order_id = searchParams.get("order_id");

    let query = supabase
      .from("joki_orders")
      .select("*")
      .eq("order_type", "progress")
      .order("created_at", { ascending: false });

    if (roblox_username) {
      query = query.eq("roblox_username", roblox_username);
    }
    if (order_id) {
      query = query.eq("order_id", order_id);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}

// POST: bikin order eternal baru (dari web admin)
export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  try {
    const body = await req.json();
    const {
      order_id,
      product,
      joki_name,
      roblox_username,
      progress_keyword,
      target_count,
      webhook_url,
    } = body;

    if (!order_id || !progress_keyword || !target_count) {
      return NextResponse.json(
        {
          success: false,
          message: "order_id, progress_keyword, target_count wajib",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("joki_orders")
      .insert({
        order_id,
        product: product || "Eternal Order",
        joki_name: joki_name || "Bot",
        roblox_username,
        schedule_date: new Date().toISOString().split("T")[0],
        schedule_time: "00:00:00",
        order_type: "progress",
        progress_keyword: progress_keyword.toLowerCase(),
        target_count,
        progress_count: 0,
        webhook_url,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}