import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      order_id,
      joki_name,
      product_title,
      amount,
      completed_at,
      buyer_name,
      roblox_username,
    } = body;

    if (!order_id || typeof amount !== "number") {
      return NextResponse.json(
        { success: false, message: "order_id & amount wajib" },
        { status: 400 }
      );
    }

    // ⭐ Upsert dengan composite unique (order_id + roblox_username)
    // Biar 1 order bisa punya BANYAK row (multi akun)
    const { error } = await supabaseAdmin
      .from("income_log")
      .upsert(
        {
          order_id,
          joki_name: joki_name || "ellan",
          product_title: product_title || "",
          amount,
          completed_at: completed_at || new Date().toISOString(),
          buyer_name: buyer_name || null,
          roblox_username: roblox_username || null,
        },
        { 
          onConflict: "order_id,roblox_username",
          ignoreDuplicates: true,   // ⭐ INI YANG BARU
        }
      );

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}