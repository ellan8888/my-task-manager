// app/api/queue/failed/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("joki_orders")
      .select("*")
      .eq("bot_process_failed", true)
      .eq("joki_name", "ellan")
      // ⭐ FIX: Jangan tampilin order yang udah completed/processing
      .not("queue_status", "in", "(completed,processing)")
      .order("bot_failed_at", { ascending: false });

    if (error) {
      console.error("[API /queue/failed] Supabase error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
    });
  } catch (err) {
    console.error("[API /queue/failed] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}