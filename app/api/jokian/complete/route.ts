import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { order_id, completed_by_bot, completed_at } = body;

    if (!order_id) {
      return NextResponse.json(
        { success: false, message: "order_id diperlukan" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("joki_orders")
      .update({
        completed_by_bot: completed_by_bot ?? true,
        completed_at: completed_at ?? new Date().toISOString(),
      })
      .eq("order_id", order_id);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Status updated" });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}